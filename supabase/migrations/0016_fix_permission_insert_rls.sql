-- ============================================================
-- 0016_fix_permission_insert_rls.sql
--
-- Helper permission non-security-definer untuk evaluasi WITH CHECK.
-- ============================================================

create or replace function public.user_can_access_permission(permission_name text)
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
    )
    or exists (
      select 1
      from public.users u
      join public.role_permission rp on rp.role = u.role
      where u.id = auth.uid()
        and rp.permission = permission_name
        and rp.enabled = true
    )
$$;

grant execute on function public.user_can_access_permission(text)
  to authenticated, service_role;

drop policy if exists "outlet_insert_admin" on public.outlet;
create policy "outlet_insert_admin" on public.outlet
  for insert to authenticated
  with check (
    public.user_can_access_permission('outlets.create')
    and public.user_can_access_branch(branch_id)
  );

drop policy if exists "cashier_insert_access" on public.cashier;
create policy "cashier_insert_access" on public.cashier
  for insert to authenticated
  with check (
    public.user_can_access_permission('cashiers.create')
    and exists (
      select 1
      from public.outlet o
      where o.id = outlet_id
        and public.user_can_access_branch(o.branch_id)
    )
  );

drop policy if exists "cah_insert_access" on public.cashier_outlet_history;
create policy "cah_insert_access" on public.cashier_outlet_history
  for insert to authenticated
  with check (
    public.user_can_access_permission('cashiers.create')
    and exists (
      select 1
      from public.outlet o
      where o.id = outlet_id
        and public.user_can_access_branch(o.branch_id)
    )
    and exists (
      select 1
      from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id
        and public.user_can_access_branch(o.branch_id)
    )
  );
