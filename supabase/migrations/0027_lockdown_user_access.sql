-- ============================================================
-- 0027_lockdown_user_access.sql
--
-- M1.2: tutup self role escalation dan hentikan akses akun nonaktif.
-- Perubahan role/status dilakukan melalui RPC service-role yang atomik
-- dan dicatat pada audit_log.
-- ============================================================

-- ---------- Active-user helpers ----------
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.is_active = true
  )
$$;

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select u.role
  from public.users u
  where u.id = auth.uid()
    and u.is_active = true
$$;

create or replace function public.user_has_branch_access(branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_user()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.user_branch ub
        where ub.user_id = auth.uid()
          and ub.branch_id = $1
      )
    )
$$;

-- Inline helper tetap dipakai policy write lama sampai M1.3 selesai.
create or replace function public.user_can_access_branch(branch_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.is_active = true
    )
    or exists (
      select 1
      from public.user_branch ub
      join public.users u on u.id = ub.user_id
      where ub.user_id = auth.uid()
        and ub.branch_id = $1
        and u.is_active = true
    )
$$;

create or replace function public.user_has_permission(permission_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.users u
      join public.role_permission rp on rp.role = u.role
      where u.id = auth.uid()
        and u.is_active = true
        and rp.permission = permission_name
        and rp.enabled = true
    )
$$;

grant execute on function public.is_active_user() to authenticated, service_role;
grant execute on function public.user_can_access_branch(uuid) to authenticated, service_role;

-- ---------- No direct profile mutation through Data API ----------
drop policy if exists "users_update_own" on public.users;
drop policy if exists "users_update_admin" on public.users;
revoke insert, update, delete on public.users from authenticated;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select to authenticated
  using (id = auth.uid() and is_active = true);

-- ---------- Audit log ----------
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, created_at desc);

alter table public.audit_log enable row level security;
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated
  using (public.is_admin());

-- ---------- Atomic admin user mutation ----------
create or replace function public.admin_update_user(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_role public.user_role default null,
  p_is_active boolean default null,
  p_full_name text default null
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  before_user public.users;
  after_user public.users;
  next_role public.user_role;
  next_is_active boolean;
  next_full_name text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if not exists (
    select 1
    from public.users actor
    where actor.id = p_actor_id
      and actor.role = 'admin'
      and actor.is_active = true
  ) then
    raise exception 'Actor admin tidak valid';
  end if;

  select * into before_user
  from public.users
  where id = p_target_user_id
  for update;

  if before_user.id is null then
    raise exception 'Pengguna tidak ditemukan';
  end if;

  next_role := coalesce(p_role, before_user.role);
  next_is_active := coalesce(p_is_active, before_user.is_active);
  next_full_name := coalesce(nullif(btrim(p_full_name), ''), before_user.full_name);

  if p_full_name is not null and char_length(btrim(p_full_name)) < 2 then
    raise exception 'Nama pengguna minimal 2 karakter';
  end if;

  if p_target_user_id = p_actor_id
    and (next_role <> before_user.role or next_is_active <> before_user.is_active) then
    raise exception 'Admin tidak dapat mengubah role atau status akunnya sendiri';
  end if;

  if before_user.role = 'admin'
    and next_role <> 'admin'
    and not exists (
      select 1
      from public.users u
      where u.id <> before_user.id
        and u.role = 'admin'
        and u.is_active = true
    ) then
    raise exception 'Minimal harus ada satu admin aktif';
  end if;

  if before_user.role = 'admin'
    and before_user.is_active = true
    and next_is_active = false
    and not exists (
      select 1
      from public.users u
      where u.id <> before_user.id
        and u.role = 'admin'
        and u.is_active = true
    ) then
    raise exception 'Minimal harus ada satu admin aktif';
  end if;

  update public.users
  set role = next_role,
      is_active = next_is_active,
      full_name = next_full_name
  where id = before_user.id
  returning * into after_user;

  insert into public.audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  )
  values (
    p_actor_id,
    'user.updated',
    'user',
    after_user.id,
    jsonb_build_object(
      'full_name', before_user.full_name,
      'role', before_user.role,
      'is_active', before_user.is_active
    ),
    jsonb_build_object(
      'full_name', after_user.full_name,
      'role', after_user.role,
      'is_active', after_user.is_active
    )
  );

  return after_user;
end;
$$;

revoke all on function public.admin_update_user(uuid, uuid, public.user_role, boolean, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_user(uuid, uuid, public.user_role, boolean, text)
  to service_role;

-- ---------- Deny all access for inactive authenticated users ----------
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'app_setup',
    'users',
    'branch',
    'outlet',
    'cashier',
    'cashier_outlet_history',
    'user_branch',
    'category',
    'category_weight_history',
    'detail',
    'detail_config_history',
    'period',
    'assessment',
    'deduction_event',
    'cashier_period_score',
    'leaderboard_entry',
    'cashier_cumulative_score',
    'mentoring_session',
    'mentoring_cashier_note',
    'invite',
    'notification',
    'period_log',
    'role_permission',
    'audit_log'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', 'active_user_guard', table_name);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_active_user()) with check (public.is_active_user())',
      'active_user_guard',
      table_name
    );
  end loop;
end;
$$;

drop policy if exists "active_user_guard" on storage.objects;
create policy "active_user_guard" on storage.objects
  as restrictive
  for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());
