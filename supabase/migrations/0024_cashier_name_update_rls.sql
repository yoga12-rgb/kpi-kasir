-- Allow configured roles to update cashier names within their branches.

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
