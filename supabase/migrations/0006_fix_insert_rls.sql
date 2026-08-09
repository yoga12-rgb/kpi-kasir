-- ============================================================
-- 0006_fix_insert_rls.sql — Perbaiki policy INSERT/UPDATE/DELETE
--
-- Masalah: function helper `security definer` (user_has_outlet_access,
-- user_has_branch_access) bisa mengembalikan nilai yang tampak benar saat
-- dipanggil langsung, tetapi gagal dievaluasi di dalam `WITH CHECK` policy
-- karena konteks evaluasi `auth.uid()` tidak selalu tersedia untuk fungsi
-- security definer saat menulis baris baru.
--
-- Solusi: gunakan fungsi pembantu TANPA security definer yang memakai
-- subquery inline. Subquery ini dievaluasi sebagai role query (authenticated)
-- dan otoritas dibaca dari tabel `users` (role) & `user_branch` (penugasan),
-- yang masing-masing punya policy baca sendiri — aman dan dapat diprediksi.
-- ============================================================

-- ---------- Helper baru: akses cabang (NON security definer) ----------
create or replace function public.user_can_access_branch(branch_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
    or exists (
      select 1 from public.user_branch ub
      where ub.user_id = auth.uid() and ub.branch_id = $1
    )
$$;

grant execute on function public.user_can_access_branch(uuid) to authenticated, service_role;

-- ============================================================
-- CASHIER
-- ============================================================
drop policy if exists "cashier_insert_access" on public.cashier;
drop policy if exists "cashier_update_access" on public.cashier;
drop policy if exists "cashier_delete_access" on public.cashier;

create policy "cashier_insert_access" on public.cashier
  for insert to authenticated
  with check (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "cashier_update_access" on public.cashier
  for update to authenticated
  using (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  )
  with check (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "cashier_delete_access" on public.cashier
  for delete to authenticated
  using (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  );

-- ============================================================
-- CASHIER OUTLET HISTORY
-- ============================================================
drop policy if exists "cah_insert_access" on public.cashier_outlet_history;
drop policy if exists "cah_update_access" on public.cashier_outlet_history;
drop policy if exists "cah_delete_access" on public.cashier_outlet_history;

create policy "cah_insert_access" on public.cashier_outlet_history
  for insert to authenticated
  with check (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
    and exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "cah_update_access" on public.cashier_outlet_history
  for update to authenticated
  using (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  )
  with check (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "cah_delete_access" on public.cashier_outlet_history
  for delete to authenticated
  using (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  );

-- ============================================================
-- ASSESSMENT
-- ============================================================
drop policy if exists "assessment_insert_access" on public.assessment;
drop policy if exists "assessment_update_access" on public.assessment;
drop policy if exists "assessment_delete_access" on public.assessment;

create policy "assessment_insert_access" on public.assessment
  for insert to authenticated
  with check (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "assessment_update_access" on public.assessment
  for update to authenticated
  using (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  )
  with check (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "assessment_delete_access" on public.assessment
  for delete to authenticated
  using (
    exists (
      select 1 from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      where c.id = cashier_id and public.user_can_access_branch(o.branch_id)
    )
  );

-- ============================================================
-- DEDUCTION EVENT
-- ============================================================
drop policy if exists "de_insert_access" on public.deduction_event;
drop policy if exists "de_delete_access" on public.deduction_event;

create policy "de_insert_access" on public.deduction_event
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessment a
      join public.cashier c on c.id = a.cashier_id
      join public.outlet o on o.id = c.outlet_id
      where a.id = assessment_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "de_delete_access" on public.deduction_event
  for delete to authenticated
  using (
    exists (
      select 1 from public.assessment a
      join public.cashier c on c.id = a.cashier_id
      join public.outlet o on o.id = c.outlet_id
      where a.id = assessment_id and public.user_can_access_branch(o.branch_id)
    )
  );

-- ============================================================
-- MENTORING SESSION
-- ============================================================
drop policy if exists "ms_insert_access" on public.mentoring_session;
drop policy if exists "ms_update_access" on public.mentoring_session;
drop policy if exists "ms_delete_access" on public.mentoring_session;

create policy "ms_insert_access" on public.mentoring_session
  for insert to authenticated
  with check (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "ms_update_access" on public.mentoring_session
  for update to authenticated
  using (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  )
  with check (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "ms_delete_access" on public.mentoring_session
  for delete to authenticated
  using (
    exists (
      select 1 from public.outlet o
      where o.id = outlet_id and public.user_can_access_branch(o.branch_id)
    )
  );

-- ============================================================
-- MENTORING CASHIER NOTE
-- ============================================================
drop policy if exists "mcn_insert_access" on public.mentoring_cashier_note;
drop policy if exists "mcn_update_access" on public.mentoring_cashier_note;
drop policy if exists "mcn_delete_access" on public.mentoring_cashier_note;

create policy "mcn_insert_access" on public.mentoring_cashier_note
  for insert to authenticated
  with check (
    exists (
      select 1 from public.mentoring_session s
      join public.outlet o on o.id = s.outlet_id
      where s.id = session_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "mcn_update_access" on public.mentoring_cashier_note
  for update to authenticated
  using (
    exists (
      select 1 from public.mentoring_session s
      join public.outlet o on o.id = s.outlet_id
      where s.id = session_id and public.user_can_access_branch(o.branch_id)
    )
  )
  with check (
    exists (
      select 1 from public.mentoring_session s
      join public.outlet o on o.id = s.outlet_id
      where s.id = session_id and public.user_can_access_branch(o.branch_id)
    )
  );

create policy "mcn_delete_access" on public.mentoring_cashier_note
  for delete to authenticated
  using (
    exists (
      select 1 from public.mentoring_session s
      join public.outlet o on o.id = s.outlet_id
      where s.id = session_id and public.user_can_access_branch(o.branch_id)
    )
  );