-- ============================================================
-- 0015_fix_operational_insert_rls.sql
--
-- Policy INSERT harus memakai helper non-security-definer
-- `user_can_access_branch`, sesuai pola perbaikan pada migration 0006.
-- ============================================================

drop policy if exists "outlet_insert_admin" on public.outlet;
create policy "outlet_insert_admin" on public.outlet
  for insert to authenticated
  with check (
    public.user_has_permission('outlets.create')
    and public.user_can_access_branch(branch_id)
  );

drop policy if exists "cashier_insert_access" on public.cashier;
create policy "cashier_insert_access" on public.cashier
  for insert to authenticated
  with check (
    public.user_has_permission('cashiers.create')
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
    public.user_has_permission('cashiers.create')
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
