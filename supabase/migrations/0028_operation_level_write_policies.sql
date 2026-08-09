-- ============================================================
-- 0028_operation_level_write_policies.sql
--
-- M1.3: ganti policy write permissive dengan policy per operasi.
-- Semua policy di bawah tetap dilindungi active_user_guard dari M1.2.
-- ============================================================

-- ---------- Access helpers include active branch/outlet/cashier ----------
create or replace function public.user_has_branch_access(branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_user()
    and exists (
      select 1
      from public.branch b
      where b.id = $1
        and b.is_active = true
    )
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

create or replace function public.user_has_cashier_access(cashier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    c.is_active
    and o.is_active
    and b.is_active
    and public.user_has_branch_access(b.id)
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id
  join public.branch b on b.id = o.branch_id
  where c.id = $1
$$;

create or replace function public.user_has_outlet_access(outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    o.is_active
    and b.is_active
    and public.user_has_branch_access(b.id)
  from public.outlet o
  join public.branch b on b.id = o.branch_id
  where o.id = $1
$$;

create or replace function public.user_can_access_branch(branch_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (
      select 1
      from public.users u
      join public.branch b on b.id = $1
      where u.id = auth.uid()
        and u.role = 'admin'
        and u.is_active = true
        and b.is_active = true
    )
    or exists (
      select 1
      from public.user_branch ub
      join public.users u on u.id = ub.user_id
      join public.branch b on b.id = ub.branch_id
      where ub.user_id = auth.uid()
        and ub.branch_id = $1
        and u.is_active = true
        and b.is_active = true
    )
$$;

-- ---------- Assessment ----------
drop policy if exists "assessment_write_server_guarded" on public.assessment;
drop policy if exists "assessment_insert_access" on public.assessment;
drop policy if exists "assessment_update_access" on public.assessment;
drop policy if exists "assessment_delete_access" on public.assessment;

create policy "assessment_insert_access" on public.assessment
  for insert to authenticated
  with check (
    public.user_has_permission('assessment')
    and exists (
      select 1
      from public.period p
      where p.id = public.assessment.period_id
        and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
    and exists (
      select 1
      from public.detail d
      where d.id = public.assessment.detail_id
        and d.is_active = true
    )
  );

create policy "assessment_update_access" on public.assessment
  for update to authenticated
  using (
    public.user_has_permission('assessment')
    and exists (
      select 1
      from public.period p
      where p.id = public.assessment.period_id
        and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
  )
  with check (
    public.user_has_permission('assessment')
    and exists (
      select 1
      from public.period p
      where p.id = public.assessment.period_id
        and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
    and exists (
      select 1
      from public.detail d
      where d.id = public.assessment.detail_id
        and d.is_active = true
    )
  );

create policy "assessment_delete_access" on public.assessment
  for delete to authenticated
  using (
    public.user_has_permission('assessment')
    and exists (
      select 1
      from public.period p
      where p.id = public.assessment.period_id
        and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
  );

-- ---------- Deduction event ----------
drop policy if exists "de_write_server_guarded" on public.deduction_event;
drop policy if exists "de_insert_access" on public.deduction_event;
drop policy if exists "de_delete_access" on public.deduction_event;
revoke update on public.deduction_event from authenticated;

create policy "de_insert_access" on public.deduction_event
  for insert to authenticated
  with check (
    public.user_has_permission('assessment')
    and public.deduction_event.created_by = auth.uid()
    and exists (
      select 1
      from public.assessment a
      join public.detail d on d.id = a.detail_id
      join public.period p on p.id = a.period_id
      where a.id = public.deduction_event.assessment_id
        and d.type = 'deduction'
        and p.status = 'open'
        and public.user_has_cashier_access(a.cashier_id)
    )
  );

create policy "de_delete_access" on public.deduction_event
  for delete to authenticated
  using (
    public.user_has_permission('assessment')
    and exists (
      select 1
      from public.assessment a
      join public.period p on p.id = a.period_id
      where a.id = public.deduction_event.assessment_id
        and p.status = 'open'
        and public.user_has_cashier_access(a.cashier_id)
    )
  );

-- ---------- Mentoring session ----------
drop policy if exists "ms_write_server_guarded" on public.mentoring_session;
drop policy if exists "ms_insert_access" on public.mentoring_session;
drop policy if exists "ms_update_access" on public.mentoring_session;
drop policy if exists "ms_delete_access" on public.mentoring_session;

create policy "ms_insert_access" on public.mentoring_session
  for insert to authenticated
  with check (
    public.user_has_permission('mentoring')
    and public.mentoring_session.conducted_by = auth.uid()
    and public.user_has_outlet_access(public.mentoring_session.outlet_id)
  );

create policy "ms_update_access" on public.mentoring_session
  for update to authenticated
  using (
    public.user_has_permission('mentoring')
    and public.user_has_outlet_access(public.mentoring_session.outlet_id)
  )
  with check (
    public.user_has_permission('mentoring')
    and public.user_has_outlet_access(public.mentoring_session.outlet_id)
  );

create policy "ms_delete_access" on public.mentoring_session
  for delete to authenticated
  using (
    public.user_has_permission('mentoring')
    and public.user_has_outlet_access(public.mentoring_session.outlet_id)
  );

-- ---------- Mentoring cashier note ----------
drop policy if exists "mcn_write_server_guarded" on public.mentoring_cashier_note;
drop policy if exists "mcn_insert_access" on public.mentoring_cashier_note;
drop policy if exists "mcn_update_access" on public.mentoring_cashier_note;
drop policy if exists "mcn_delete_access" on public.mentoring_cashier_note;

create policy "mcn_insert_access" on public.mentoring_cashier_note
  for insert to authenticated
  with check (
    public.user_has_permission('mentoring')
    and exists (
      select 1
      from public.mentoring_session s
      join public.cashier c on c.outlet_id = s.outlet_id
      where s.id = public.mentoring_cashier_note.session_id
        and c.id = public.mentoring_cashier_note.cashier_id
        and public.user_has_outlet_access(s.outlet_id)
        and public.user_has_cashier_access(c.id)
    )
  );

create policy "mcn_update_access" on public.mentoring_cashier_note
  for update to authenticated
  using (
    public.user_has_permission('mentoring')
    and exists (
      select 1
      from public.mentoring_session s
      join public.cashier c on c.outlet_id = s.outlet_id
      where s.id = public.mentoring_cashier_note.session_id
        and c.id = public.mentoring_cashier_note.cashier_id
        and public.user_has_outlet_access(s.outlet_id)
        and public.user_has_cashier_access(c.id)
    )
  )
  with check (
    public.user_has_permission('mentoring')
    and exists (
      select 1
      from public.mentoring_session s
      join public.cashier c on c.outlet_id = s.outlet_id
      where s.id = public.mentoring_cashier_note.session_id
        and c.id = public.mentoring_cashier_note.cashier_id
        and public.user_has_outlet_access(s.outlet_id)
        and public.user_has_cashier_access(c.id)
    )
  );

create policy "mcn_delete_access" on public.mentoring_cashier_note
  for delete to authenticated
  using (
    public.user_has_permission('mentoring')
    and exists (
      select 1
      from public.mentoring_session s
      join public.cashier c on c.outlet_id = s.outlet_id
      where s.id = public.mentoring_cashier_note.session_id
        and c.id = public.mentoring_cashier_note.cashier_id
        and public.user_has_outlet_access(s.outlet_id)
        and public.user_has_cashier_access(c.id)
    )
  );
