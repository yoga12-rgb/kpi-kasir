-- ============================================================
-- 0017_inline_operational_insert_rls.sql
--
-- Evaluasi INSERT dibuat inline agar auth.uid() dan RLS user_branch
-- tetap berada pada konteks role authenticated saat WITH CHECK berjalan.
-- ============================================================

drop policy if exists "outlet_insert_admin" on public.outlet;
create policy "outlet_insert_admin" on public.outlet
  for insert to authenticated
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
          and rp.permission = 'outlets.create'
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

drop policy if exists "cashier_insert_access" on public.cashier;
create policy "cashier_insert_access" on public.cashier
  for insert to authenticated
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
          and rp.permission = 'cashiers.create'
          and rp.enabled = true
      )
    )
    and exists (
      select 1
      from public.outlet o
      where o.id = public.cashier.outlet_id
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
              and ub.branch_id = o.branch_id
          )
        )
    )
  );

drop policy if exists "cah_insert_access" on public.cashier_outlet_history;
create policy "cah_insert_access" on public.cashier_outlet_history
  for insert to authenticated
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
          and rp.permission = 'cashiers.create'
          and rp.enabled = true
      )
    )
    and exists (
      select 1
      from public.outlet o
      where o.id = public.cashier_outlet_history.outlet_id
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
              and ub.branch_id = o.branch_id
          )
        )
    )
    and exists (
      select 1
      from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = public.cashier_outlet_history.cashier_id
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
              and ub.branch_id = o.branch_id
          )
        )
    )
  );
