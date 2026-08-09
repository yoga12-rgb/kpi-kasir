-- ============================================================
-- 0029_leaderboard_and_column_scope.sql
--
-- M1.4: scope leaderboard ke cabang actor dan batasi update client
-- hanya pada nama kasir/outlet.
-- ============================================================

-- ---------- Leaderboard branch isolation ----------
drop policy if exists "le_select_auth" on public.leaderboard_entry;
drop policy if exists "leaderboard_select_access" on public.leaderboard_entry;

create policy "leaderboard_select_access" on public.leaderboard_entry
  for select to authenticated
  using (
    public.user_has_permission('leaderboard')
    and public.user_has_branch_access(branch_id)
  );

-- ---------- Cashier name-only client update ----------
drop policy if exists "cashier_update_access" on public.cashier;
create policy "cashier_update_access" on public.cashier
  for update to authenticated
  using (
    public.user_has_permission('cashiers.update')
    and public.user_has_cashier_access(id)
  )
  with check (
    public.user_has_permission('cashiers.update')
    and public.user_has_outlet_access(outlet_id)
  );

revoke update on public.cashier from authenticated;
grant update (name) on public.cashier to authenticated;

-- ---------- Outlet name-only client update ----------
drop policy if exists "outlet_update_access" on public.outlet;
create policy "outlet_update_access" on public.outlet
  for update to authenticated
  using (
    public.user_has_permission('outlets.update')
    and public.user_has_outlet_access(id)
  )
  with check (
    public.user_has_permission('outlets.update')
    and public.user_has_outlet_access(id)
  );

revoke update on public.outlet from authenticated;
grant update (name) on public.outlet to authenticated;
