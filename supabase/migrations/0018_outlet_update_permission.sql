-- ============================================================
-- 0018_outlet_update_permission.sql
-- ============================================================

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
      'outlets.update',
      'cashiers.view',
      'cashiers.create',
      'notifications'
    )
  );

insert into public.role_permission (role, permission, enabled)
values
  ('admin'::public.user_role, 'outlets.update', true),
  ('manager'::public.user_role, 'outlets.update', true),
  ('supervisor'::public.user_role, 'outlets.update', false)
on conflict (role, permission) do nothing;

-- Pengguna yang diberi izin edit juga perlu membaca outlet target untuk
-- memuat form dan memvalidasi cabang sebelum update.
drop policy if exists "branch_select_auth" on public.branch;
create policy "branch_select_auth" on public.branch
  for select to authenticated
  using (
    (
      public.user_has_permission('branches.view')
      or public.user_has_permission('outlets.view')
      or public.user_has_permission('outlets.update')
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
      or public.user_has_permission('outlets.update')
      or public.user_has_permission('cashiers.view')
    )
    and public.user_has_outlet_access(id)
  );

drop policy if exists "outlet_update_admin" on public.outlet;
drop policy if exists "outlet_update_access" on public.outlet;
create policy "outlet_update_access" on public.outlet
  for update to authenticated
  using (
    (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.role = 'admin'
      )
      or exists (
        select 1
        from public.users u
        join public.role_permission rp on rp.role = u.role
        where u.id = auth.uid()
          and rp.permission = 'outlets.update'
          and rp.enabled = true
      )
    )
    and (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.role = 'admin'
      )
      or exists (
        select 1
        from public.user_branch ub
        where ub.user_id = auth.uid()
          and ub.branch_id = public.outlet.branch_id
      )
    )
  )
  with check (
    (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.role = 'admin'
      )
      or exists (
        select 1
        from public.users u
        join public.role_permission rp on rp.role = u.role
        where u.id = auth.uid()
          and rp.permission = 'outlets.update'
          and rp.enabled = true
      )
    )
    and (
      exists (
        select 1
        from public.users u
        where u.id = auth.uid()
          and u.role = 'admin'
      )
      or exists (
        select 1
        from public.user_branch ub
        where ub.user_id = auth.uid()
          and ub.branch_id = public.outlet.branch_id
      )
    )
  );
