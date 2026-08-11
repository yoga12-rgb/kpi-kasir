-- Bukti foto sesi Pendampingan.
-- Object Storage dan database tidak berbagi transaksi; row pending menjadi
-- reservation yang mengikat kuota sebelum object diupload.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'mentoring-evidence',
  'mentoring-evidence',
  false,
  358400,
  array['image/webp']::text[]
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.mentoring_evidence (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mentoring_session (id) on delete restrict,
  object_path text not null unique,
  content_sha256 text not null,
  sort_order smallint not null check (sort_order between 0 and 2),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  mime_type text not null default 'image/webp' check (mime_type = 'image/webp'),
  byte_size integer not null check (byte_size between 1 and 358400),
  width integer not null check (width between 1 and 1280),
  height integer not null check (height between 1 and 1280),
  created_by uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  constraint mentoring_evidence_sha256_check
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint mentoring_evidence_path_check
    check (
      object_path ~ '^session/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/evidence-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.]webp$'
    ),
  constraint mentoring_evidence_ready_at_check
    check (
      (status = 'pending' and ready_at is null)
      or (status = 'ready' and ready_at is not null)
    ),
  constraint mentoring_evidence_active_slot_unique
    unique (session_id, sort_order),
  constraint mentoring_evidence_session_hash_unique
    unique (session_id, content_sha256)
);

create index mentoring_evidence_session_status_order_idx
  on public.mentoring_evidence (session_id, status, sort_order);

create index mentoring_evidence_status_created_idx
  on public.mentoring_evidence (status, created_at);

alter table public.mentoring_evidence enable row level security;

grant select on public.mentoring_evidence to authenticated;
grant all on public.mentoring_evidence to service_role;
revoke insert, update, delete, truncate, references, trigger
  on public.mentoring_evidence from anon, authenticated;

drop policy if exists "mentoring_evidence_select_access" on public.mentoring_evidence;
create policy "mentoring_evidence_select_access" on public.mentoring_evidence
  for select to authenticated
  using (
    status = 'ready'
    and public.user_has_permission('mentoring')
    and exists (
      select 1
      from public.mentoring_session s
      where s.id = mentoring_evidence.session_id
        and public.user_has_outlet_access(s.outlet_id)
    )
  );

drop policy if exists "active_user_guard" on public.mentoring_evidence;
create policy "active_user_guard" on public.mentoring_evidence
  as restrictive
  for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

create or replace function public.reserve_mentoring_evidence(
  p_session_id uuid,
  p_actor_id uuid,
  p_content_sha256 text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_session public.mentoring_session;
  v_existing public.mentoring_evidence;
  v_evidence public.mentoring_evidence;
  v_evidence_id uuid := gen_random_uuid();
  v_slot smallint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_session_id is null
    or p_actor_id is null
    or p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_byte_size is null
    or p_byte_size < 1
    or p_byte_size > 358400
    or p_width is null
    or p_width < 1
    or p_width > 1280
    or p_height is null
    or p_height < 1
    or p_height > 1280 then
    raise exception 'Metadata bukti foto tidak valid';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id
  for share;

  if v_actor.id is null or not v_actor.is_active then
    raise exception 'Actor bukti foto tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.role_permission
      where role = v_actor.role
        and permission = 'mentoring'
        and enabled = true
    ) then
    raise exception 'Actor tidak memiliki permission mentoring';
  end if;

  -- Mengunci parent session membuat count kuota dan pemilihan slot atomik
  -- terhadap dua request upload yang datang bersamaan.
  select s.* into v_session
  from public.mentoring_session s
  join public.outlet o on o.id = s.outlet_id
  join public.branch b on b.id = o.branch_id
  where s.id = p_session_id
    and o.is_active = true
    and b.is_active = true
  for update of s;

  if v_session.id is null then
    raise exception 'Sesi pendampingan tidak ditemukan atau tidak aktif';
  end if;

  if v_actor.role <> 'admin' and v_session.conducted_by <> p_actor_id then
    raise exception 'Hanya pencatat sesi yang dapat menambahkan bukti foto';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.user_branch ub
      where ub.user_id = p_actor_id
        and ub.branch_id = (
          select o.branch_id
          from public.outlet o
          where o.id = v_session.outlet_id
        )
    ) then
    raise exception 'Actor tidak memiliki akses ke cabang sesi';
  end if;

  select * into v_existing
  from public.mentoring_evidence
  where session_id = v_session.id
    and content_sha256 = p_content_sha256
  for update;

  if v_existing.id is not null then
    return jsonb_build_object(
      'evidence', to_jsonb(v_existing),
      'was_existing', true
    );
  end if;

  select slot::smallint into v_slot
  from generate_series(0, 2) as slot
  where not exists (
    select 1
    from public.mentoring_evidence e
    where e.session_id = v_session.id
      and e.sort_order = slot
  )
  order by slot
  limit 1;

  if v_slot is null then
    raise exception 'Maksimal tiga bukti foto per sesi';
  end if;

  insert into public.mentoring_evidence (
    id,
    session_id,
    object_path,
    content_sha256,
    sort_order,
    status,
    mime_type,
    byte_size,
    width,
    height,
    created_by
  )
  values (
    v_evidence_id,
    v_session.id,
    format('session/%s/evidence-%s.webp', v_session.id, v_evidence_id),
    p_content_sha256,
    v_slot,
    'pending',
    'image/webp',
    p_byte_size,
    p_width,
    p_height,
    p_actor_id
  )
  returning * into v_evidence;

  return jsonb_build_object(
    'evidence', to_jsonb(v_evidence),
    'was_existing', false
  );
end;
$$;

create or replace function public.finalize_mentoring_evidence(
  p_evidence_id uuid,
  p_actor_id uuid,
  p_content_sha256 text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns public.mentoring_evidence
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_evidence public.mentoring_evidence;
  v_session public.mentoring_session;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_evidence_id is null
    or p_actor_id is null
    or p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_byte_size is null
    or p_byte_size < 1
    or p_byte_size > 358400
    or p_width is null
    or p_width < 1
    or p_width > 1280
    or p_height is null
    or p_height < 1
    or p_height > 1280 then
    raise exception 'Metadata bukti foto tidak valid';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id
  for share;

  if v_actor.id is null or not v_actor.is_active then
    raise exception 'Actor bukti foto tidak aktif atau tidak ditemukan';
  end if;

  select e.* into v_evidence
  from public.mentoring_evidence e
  where e.id = p_evidence_id
  for update;

  if v_evidence.id is null then
    raise exception 'Bukti foto tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.role_permission
      where role = v_actor.role
        and permission = 'mentoring'
        and enabled = true
    ) then
    raise exception 'Actor tidak memiliki permission mentoring';
  end if;

  select s.* into v_session
  from public.mentoring_session s
  join public.outlet o on o.id = s.outlet_id
  join public.branch b on b.id = o.branch_id
  where s.id = v_evidence.session_id
    and o.is_active = true
    and b.is_active = true;

  if v_session.id is null then
    raise exception 'Sesi pendampingan tidak ditemukan atau tidak aktif';
  end if;

  if v_actor.role <> 'admin' and v_session.conducted_by <> p_actor_id then
    raise exception 'Actor tidak dapat menyelesaikan bukti foto sesi ini';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.user_branch ub
      join public.outlet o on o.branch_id = ub.branch_id
      where ub.user_id = p_actor_id
        and o.id = v_session.outlet_id
    ) then
    raise exception 'Actor tidak memiliki akses ke cabang sesi';
  end if;

  if v_evidence.content_sha256 <> p_content_sha256
    or v_evidence.byte_size <> p_byte_size
    or v_evidence.width <> p_width
    or v_evidence.height <> p_height then
    raise exception 'Metadata bukti foto tidak sesuai';
  end if;

  if v_evidence.status = 'ready' then
    return v_evidence;
  end if;

  update public.mentoring_evidence
  set status = 'ready',
      ready_at = now()
  where id = v_evidence.id
  returning * into v_evidence;

  return v_evidence;
end;
$$;

create or replace function public.abort_mentoring_evidence(
  p_evidence_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  delete from public.mentoring_evidence
  where id = p_evidence_id
    and status = 'pending';

  v_deleted := found;
  return v_deleted;
end;
$$;

revoke all on function public.reserve_mentoring_evidence(uuid, uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_mentoring_evidence(uuid, uuid, text, integer, integer, integer)
  to service_role;

revoke all on function public.finalize_mentoring_evidence(uuid, uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.finalize_mentoring_evidence(uuid, uuid, text, integer, integer, integer)
  to service_role;

revoke all on function public.abort_mentoring_evidence(uuid)
  from public, anon, authenticated;
grant execute on function public.abort_mentoring_evidence(uuid)
  to service_role;
