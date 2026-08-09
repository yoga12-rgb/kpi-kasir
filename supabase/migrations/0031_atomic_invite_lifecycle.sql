-- ============================================================
-- 0031_atomic_invite_lifecycle.sql
--
-- M2.2: konsumsi invite, revoke, dan regenerate harus atomik di DB.
-- Auth user dibuat/diubah oleh trusted server di luar transaksi ini;
-- seluruh state public yang menentukan akses dikunci di dalam RPC.
-- ============================================================

alter table public.invite
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.users (id) on delete set null;

create index invite_revoked_idx on public.invite (revoked_at, created_at desc);

create or replace function public.consume_invite(
  p_token text,
  p_user_id uuid,
  p_email text,
  p_full_name text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite;
  v_user public.users;
  v_branch_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_user_id is null or nullif(btrim(p_email), '') is null then
    raise exception 'Identitas pengguna tidak valid';
  end if;

  if char_length(btrim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Nama pengguna minimal 2 karakter';
  end if;

  select * into v_invite
  from public.invite
  where token = btrim(p_token)
  for update;

  if v_invite.id is null then
    raise exception 'Link undangan tidak ditemukan';
  end if;

  if v_invite.used_at is not null then
    raise exception 'Link undangan sudah digunakan';
  end if;

  if v_invite.revoked_at is not null then
    raise exception 'Link undangan sudah dicabut';
  end if;

  if v_invite.expires_at <= now() then
    raise exception 'Link undangan sudah kedaluwarsa';
  end if;

  v_branch_count := coalesce(array_length(v_invite.branch_ids, 1), 0);
  if v_branch_count = 0
    or (select count(distinct branch_id)::integer from unnest(v_invite.branch_ids) as branch_id)
       <> v_branch_count
    or exists (
      select 1
      from unnest(v_invite.branch_ids) as requested(branch_id)
      left join public.branch b on b.id = requested.branch_id and b.is_active = true
      where b.id is null
    ) then
    raise exception 'Invite memiliki cabang aktif yang tidak valid';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if v_user.id is null then
    raise exception 'Profil pengguna tidak ditemukan';
  end if;

  if lower(btrim(v_user.email)) <> lower(btrim(p_email)) then
    raise exception 'Email pendaftaran tidak cocok dengan akun Auth';
  end if;

  if v_user.is_active then
    raise exception 'Akun pengguna sudah aktif';
  end if;

  update public.users
  set full_name = btrim(p_full_name),
      role = v_invite.role,
      is_active = true
  where id = v_user.id
  returning * into v_user;

  delete from public.user_branch
  where user_id = v_user.id;

  insert into public.user_branch (user_id, branch_id)
  select v_user.id, branch_id
  from unnest(v_invite.branch_ids) as branch_id;

  update public.invite
  set used_at = now(),
      accepted_user_id = v_user.id
  where id = v_invite.id;

  return v_user;
end;
$$;

create or replace function public.revoke_invite(
  p_invite_id uuid,
  p_actor_id uuid
)
returns public.invite
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_actor_id and role = 'admin' and is_active = true
  ) then
    raise exception 'Actor admin tidak valid';
  end if;

  select * into v_invite
  from public.invite
  where id = p_invite_id
  for update;

  if v_invite.id is null then
    raise exception 'Invite tidak ditemukan';
  end if;

  if v_invite.used_at is not null then
    raise exception 'Invite yang sudah digunakan tidak dapat dicabut';
  end if;

  if v_invite.revoked_at is null then
    update public.invite
    set revoked_at = now(),
        revoked_by = p_actor_id
    where id = v_invite.id
    returning * into v_invite;
  end if;

  return v_invite;
end;
$$;

create or replace function public.regenerate_invite(
  p_invite_id uuid,
  p_actor_id uuid,
  p_new_token text,
  p_expires_at timestamptz
)
returns public.invite
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invite;
  v_branch_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if not exists (
    select 1 from public.users
    where id = p_actor_id and role = 'admin' and is_active = true
  ) then
    raise exception 'Actor admin tidak valid';
  end if;

  if char_length(btrim(coalesce(p_new_token, ''))) < 32 or p_expires_at <= now() then
    raise exception 'Token atau masa berlaku baru tidak valid';
  end if;

  select * into v_invite
  from public.invite
  where id = p_invite_id
  for update;

  if v_invite.id is null then
    raise exception 'Invite tidak ditemukan';
  end if;

  if v_invite.used_at is not null then
    raise exception 'Invite yang sudah digunakan tidak dapat dibuat ulang';
  end if;

  v_branch_count := coalesce(array_length(v_invite.branch_ids, 1), 0);
  if v_branch_count = 0
    or exists (
      select 1
      from unnest(v_invite.branch_ids) as requested(branch_id)
      left join public.branch b on b.id = requested.branch_id and b.is_active = true
      where b.id is null
    ) then
    raise exception 'Invite memiliki cabang aktif yang tidak valid';
  end if;

  update public.invite
  set token = btrim(p_new_token),
      expires_at = p_expires_at,
      revoked_at = null,
      revoked_by = null
  where id = v_invite.id
  returning * into v_invite;

  return v_invite;
end;
$$;

revoke all on function public.consume_invite(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_invite(text, uuid, text, text) to service_role;

revoke all on function public.revoke_invite(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_invite(uuid, uuid) to service_role;

revoke all on function public.regenerate_invite(uuid, uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.regenerate_invite(uuid, uuid, text, timestamptz) to service_role;
