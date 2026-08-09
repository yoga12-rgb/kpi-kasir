-- Supabase production rejects UPDATE statements without a WHERE clause.
-- Target the locked app_setup singleton explicitly in both setup lifecycle RPCs.

create or replace function public.reserve_setup(p_claim_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_setup public.app_setup;
  v_now timestamptz := now();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_claim_id is null then
    raise exception 'Claim setup tidak valid';
  end if;

  select * into v_setup
  from public.app_setup
  order by id
  limit 1
  for update;

  if v_setup.id is null then
    raise exception 'Konfigurasi setup tidak ditemukan';
  end if;

  if v_setup.admin_created then
    raise exception 'Setup sudah selesai';
  end if;

  if exists (
    select 1 from public.users
    where role = 'admin' and is_active = true
  ) then
    raise exception 'Setup sudah selesai';
  end if;

  if v_setup.setup_claim_id is not null
    and v_setup.setup_claimed_at > v_now - interval '10 minutes' then
    raise exception 'Setup sedang diproses';
  end if;

  if v_setup.setup_attempt_window_at is null
    or v_setup.setup_attempt_window_at <= v_now - interval '15 minutes' then
    v_setup.setup_attempt_count := 0;
    v_setup.setup_attempt_window_at := v_now;
  end if;

  if v_setup.setup_attempt_count >= 5 then
    raise exception 'Terlalu banyak percobaan setup, coba lagi nanti';
  end if;

  update public.app_setup
  set setup_claim_id = p_claim_id,
      setup_claimed_at = v_now,
      setup_attempt_count = v_setup.setup_attempt_count + 1,
      setup_attempt_window_at = v_setup.setup_attempt_window_at
  where id = v_setup.id;

  if not found then
    raise exception 'Konfigurasi setup tidak dapat diperbarui';
  end if;

  return true;
end;
$$;

create or replace function public.finalize_setup(
  p_claim_id uuid,
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
  v_setup public.app_setup;
  v_user public.users;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_claim_id is null or p_user_id is null
    or nullif(btrim(p_email), '') is null
    or char_length(btrim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Data finalisasi setup tidak valid';
  end if;

  select * into v_setup
  from public.app_setup
  order by id
  limit 1
  for update;

  if v_setup.id is null then
    raise exception 'Konfigurasi setup tidak ditemukan';
  end if;

  if v_setup.admin_created then
    raise exception 'Setup sudah selesai';
  end if;

  if v_setup.setup_claim_id is distinct from p_claim_id
    or v_setup.setup_claimed_at is null
    or v_setup.setup_claimed_at <= now() - interval '10 minutes' then
    raise exception 'Claim setup tidak ditemukan atau sudah kedaluwarsa';
  end if;

  select * into v_user
  from public.users
  where id = p_user_id
  for update;

  if v_user.id is null then
    raise exception 'Profil admin tidak ditemukan';
  end if;

  if lower(btrim(v_user.email)) <> lower(btrim(p_email)) then
    raise exception 'Email setup tidak cocok dengan profile';
  end if;

  update public.users
  set role = 'admin',
      full_name = btrim(p_full_name),
      is_active = true
  where id = v_user.id
  returning * into v_user;

  update public.app_setup
  set admin_created = true,
      completed_at = now(),
      setup_claim_id = null,
      setup_claimed_at = null
  where id = v_setup.id;

  if not found then
    raise exception 'Konfigurasi setup tidak dapat diselesaikan';
  end if;

  return v_user;
end;
$$;

revoke all on function public.reserve_setup(uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_setup(uuid) to service_role;

revoke all on function public.finalize_setup(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.finalize_setup(uuid, uuid, text, text) to service_role;
