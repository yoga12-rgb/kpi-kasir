-- ============================================================
-- 0014_granular_operational_permissions.sql
--
-- Pisahkan akses operasional menjadi lihat dan tambah. Manager dapat
-- diberi akses penuh pada cabang yang ditugaskan, sedangkan supervisor
-- secara default hanya dapat melihat data tersebut.
-- ============================================================

delete from public.role_permission
where permission in ('branches', 'cashiers');

alter table public.role_permission
  drop constraint if exists role_permission_permission_check;

alter table public.role_permission
  add constraint role_permission_permission_check
  check (
    permission in (
      'assessment',
      'leaderboard',
      'mentoring',
      'branches.view',
      'outlets.view',
      'outlets.create',
      'cashiers.view',
      'cashiers.create',
      'notifications'
    )
  );

insert into public.role_permission (role, permission, enabled)
select roles.role, permissions.permission, permissions.permission = any(roles.enabled_permissions)
from (
  values
    (
      'admin'::public.user_role,
      array[
        'assessment',
        'leaderboard',
        'mentoring',
        'branches.view',
        'outlets.view',
        'outlets.create',
        'cashiers.view',
        'cashiers.create',
        'notifications'
      ]::text[]
    ),
    (
      'manager'::public.user_role,
      array[
        'assessment',
        'leaderboard',
        'mentoring',
        'branches.view',
        'outlets.view',
        'outlets.create',
        'cashiers.view',
        'cashiers.create',
        'notifications'
      ]::text[]
    ),
    (
      'supervisor'::public.user_role,
      array[
        'assessment',
        'leaderboard',
        'mentoring',
        'branches.view',
        'outlets.view',
        'cashiers.view',
        'notifications'
      ]::text[]
    )
) as roles(role, enabled_permissions)
cross join (
  values
    ('assessment'),
    ('leaderboard'),
    ('mentoring'),
    ('branches.view'),
    ('outlets.view'),
    ('outlets.create'),
    ('cashiers.view'),
    ('cashiers.create'),
    ('notifications')
) as permissions(permission)
on conflict (role, permission) do nothing;

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
        and rp.permission = permission_name
        and rp.enabled = true
    )
$$;

grant execute on function public.user_has_permission(text) to authenticated, service_role;

-- Batasi pembacaan langsung dari Supabase ke izin dan cabang yang sesuai.
drop policy if exists "branch_select_auth" on public.branch;
create policy "branch_select_auth" on public.branch
  for select to authenticated
  using (
    (
      public.user_has_permission('branches.view')
      or public.user_has_permission('outlets.view')
      or public.user_has_permission('cashiers.view')
    )
    and public.user_has_branch_access(id)
  );

drop policy if exists "outlet_select_auth" on public.outlet;
create policy "outlet_select_auth" on public.outlet
  for select to authenticated
  using (
    (
      public.user_has_permission('branches.view')
      or public.user_has_permission('outlets.view')
      or public.user_has_permission('cashiers.view')
    )
    and public.user_has_outlet_access(id)
  );

drop policy if exists "outlet_insert_admin" on public.outlet;
create policy "outlet_insert_admin" on public.outlet
  for insert to authenticated
  with check (
    public.user_has_permission('outlets.create')
    and public.user_has_branch_access(branch_id)
  );

drop policy if exists "cashier_select_access" on public.cashier;
create policy "cashier_select_access" on public.cashier
  for select to authenticated
  using (
    public.user_has_permission('cashiers.view')
    and public.user_has_cashier_access(id)
  );

drop policy if exists "cashier_insert_access" on public.cashier;
create policy "cashier_insert_access" on public.cashier
  for insert to authenticated
  with check (
    public.user_has_permission('cashiers.create')
    and public.user_has_outlet_access(outlet_id)
  );

drop policy if exists "cashier_update_access" on public.cashier;
create policy "cashier_update_access" on public.cashier
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cashier_delete_access" on public.cashier;
create policy "cashier_delete_access" on public.cashier
  for delete to authenticated
  using (public.is_admin());

drop policy if exists "cah_select_access" on public.cashier_outlet_history;
create policy "cah_select_access" on public.cashier_outlet_history
  for select to authenticated
  using (
    public.user_has_permission('cashiers.view')
    and public.user_has_cashier_access(cashier_id)
  );

drop policy if exists "cah_insert_access" on public.cashier_outlet_history;
create policy "cah_insert_access" on public.cashier_outlet_history
  for insert to authenticated
  with check (
    public.user_has_permission('cashiers.create')
    and public.user_has_outlet_access(outlet_id)
    and public.user_has_cashier_access(cashier_id)
  );

drop policy if exists "cah_update_access" on public.cashier_outlet_history;
create policy "cah_update_access" on public.cashier_outlet_history
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "cah_delete_access" on public.cashier_outlet_history;
create policy "cah_delete_access" on public.cashier_outlet_history
  for delete to authenticated
  using (public.is_admin());

create or replace function public.storage_can_access_cashier_photo(cashier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_has_permission('cashiers.view')
    and public.user_can_access_branch(o.branch_id)
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id
  where c.id = $1
$$;

-- Upload, ganti, dan hapus foto adalah operasi edit; tetap khusus admin.
drop policy if exists "cashier_photos_insert_own_branch" on storage.objects;
drop policy if exists "cashier_photos_update_own_branch" on storage.objects;
drop policy if exists "cashier_photos_delete_own_branch" on storage.objects;

create policy "cashier_photos_insert_own_branch" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cashier-photos'
    and public.is_admin()
    and public.storage_can_access_cashier_photo_path(name)
  );

create policy "cashier_photos_update_own_branch" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.is_admin()
    and public.storage_can_access_cashier_photo_path(name)
  )
  with check (
    bucket_id = 'cashier-photos'
    and public.is_admin()
    and public.storage_can_access_cashier_photo_path(name)
  );

create policy "cashier_photos_delete_own_branch" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.is_admin()
    and public.storage_can_access_cashier_photo_path(name)
  );
