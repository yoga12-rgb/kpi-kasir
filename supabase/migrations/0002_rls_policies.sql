-- ============================================================
-- 0002_rls_policies.sql — Row Level Security
-- Sesuai technical-spec.md §7
-- ============================================================

-- ---------- HELPER FUNCTIONS ----------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.user_has_branch_access(branch_id uuid)
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
      from public.user_branch ub
      where ub.user_id = auth.uid()
        and ub.branch_id = $1
    )
$$;

-- Akses cabang dari cashier (via outlet)
create or replace function public.user_has_cashier_access(cashier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_branch_access(o.branch_id)
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id
  where c.id = $1
$$;

-- Akses cabang dari outlet
create or replace function public.user_has_outlet_access(outlet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.user_has_branch_access(o.branch_id)
  from public.outlet o
  where o.id = $1
$$;

-- ---------- TRIGGER: buat profil user otomatis saat signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    'supervisor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ENABLE RLS
-- ============================================================
alter table public.app_setup enable row level security;
alter table public.users enable row level security;
alter table public.branch enable row level security;
alter table public.outlet enable row level security;
alter table public.cashier enable row level security;
alter table public.cashier_outlet_history enable row level security;
alter table public.user_branch enable row level security;
alter table public.category enable row level security;
alter table public.category_weight_history enable row level security;
alter table public.detail enable row level security;
alter table public.detail_config_history enable row level security;
alter table public.period enable row level security;
alter table public.assessment enable row level security;
alter table public.deduction_event enable row level security;
alter table public.cashier_period_score enable row level security;
alter table public.leaderboard_entry enable row level security;
alter table public.cashier_cumulative_score enable row level security;
alter table public.mentoring_session enable row level security;
alter table public.mentoring_cashier_note enable row level security;
alter table public.invite enable row level security;
alter table public.notification enable row level security;
alter table public.period_log enable row level security;

-- ============================================================
-- APP SETUP
-- ============================================================
create policy "app_setup_select_auth" on public.app_setup
  for select to authenticated
  using (true);

-- write hanya via server/service role

-- ============================================================
-- USERS
-- ============================================================
create policy "users_select_own" on public.users
  for select to authenticated
  using (id = auth.uid());

create policy "users_select_admin" on public.users
  for select to authenticated
  using (public.is_admin());

create policy "users_update_own" on public.users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users_update_admin" on public.users
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- insert via trigger (security definer) / service role

-- ============================================================
-- BRANCH
-- ============================================================
create policy "branch_select_auth" on public.branch
  for select to authenticated
  using (true);

create policy "branch_insert_admin" on public.branch
  for insert to authenticated
  with check (public.is_admin());

create policy "branch_update_admin" on public.branch
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "branch_delete_admin" on public.branch
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- OUTLET
-- ============================================================
create policy "outlet_select_auth" on public.outlet
  for select to authenticated
  using (true);

create policy "outlet_insert_admin" on public.outlet
  for insert to authenticated
  with check (public.is_admin());

create policy "outlet_update_admin" on public.outlet
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "outlet_delete_admin" on public.outlet
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- CASHIER
-- ============================================================
create policy "cashier_select_access" on public.cashier
  for select to authenticated
  using (public.user_has_cashier_access(id));

create policy "cashier_insert_access" on public.cashier
  for insert to authenticated
  with check (public.user_has_outlet_access(outlet_id));

create policy "cashier_update_access" on public.cashier
  for update to authenticated
  using (public.user_has_cashier_access(id))
  with check (public.user_has_outlet_access(outlet_id));

create policy "cashier_delete_access" on public.cashier
  for delete to authenticated
  using (public.user_has_cashier_access(id));

-- ============================================================
-- CASHIER OUTLET HISTORY
-- ============================================================
create policy "cah_select_access" on public.cashier_outlet_history
  for select to authenticated
  using (public.user_has_cashier_access(cashier_id));

create policy "cah_insert_access" on public.cashier_outlet_history
  for insert to authenticated
  with check (public.user_has_cashier_access(cashier_id) and public.user_has_outlet_access(outlet_id));

create policy "cah_update_access" on public.cashier_outlet_history
  for update to authenticated
  using (public.user_has_cashier_access(cashier_id))
  with check (public.user_has_cashier_access(cashier_id));

create policy "cah_delete_access" on public.cashier_outlet_history
  for delete to authenticated
  using (public.user_has_cashier_access(cashier_id));

-- ============================================================
-- USER BRANCH
-- ============================================================
create policy "user_branch_select_own" on public.user_branch
  for select to authenticated
  using (user_id = auth.uid());

create policy "user_branch_select_admin" on public.user_branch
  for select to authenticated
  using (public.is_admin());

create policy "user_branch_insert_admin" on public.user_branch
  for insert to authenticated
  with check (public.is_admin());

create policy "user_branch_update_admin" on public.user_branch
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "user_branch_delete_admin" on public.user_branch
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- CATEGORY
-- ============================================================
create policy "category_select_auth" on public.category
  for select to authenticated
  using (true);

create policy "category_insert_admin" on public.category
  for insert to authenticated
  with check (public.is_admin());

create policy "category_update_admin" on public.category
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "category_delete_admin" on public.category
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- CATEGORY WEIGHT HISTORY
-- ============================================================
create policy "cwh_select_auth" on public.category_weight_history
  for select to authenticated
  using (true);

-- insert/update/delete via server/service role

-- ============================================================
-- DETAIL
-- ============================================================
create policy "detail_select_auth" on public.detail
  for select to authenticated
  using (true);

create policy "detail_insert_admin" on public.detail
  for insert to authenticated
  with check (public.is_admin());

create policy "detail_update_admin" on public.detail
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "detail_delete_admin" on public.detail
  for delete to authenticated
  using (public.is_admin());

-- ============================================================
-- DETAIL CONFIG HISTORY
-- ============================================================
create policy "dch_select_auth" on public.detail_config_history
  for select to authenticated
  using (true);

-- write via server/service role

-- ============================================================
-- PERIOD
-- ============================================================
create policy "period_select_auth" on public.period
  for select to authenticated
  using (true);

create policy "period_insert_admin" on public.period
  for insert to authenticated
  with check (public.is_admin());

create policy "period_update_admin" on public.period
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================
-- ASSESSMENT
-- ============================================================
create policy "assessment_select_access" on public.assessment
  for select to authenticated
  using (public.user_has_cashier_access(cashier_id));

create policy "assessment_insert_access" on public.assessment
  for insert to authenticated
  with check (public.user_has_cashier_access(cashier_id));

create policy "assessment_update_access" on public.assessment
  for update to authenticated
  using (public.user_has_cashier_access(cashier_id))
  with check (public.user_has_cashier_access(cashier_id));

create policy "assessment_delete_access" on public.assessment
  for delete to authenticated
  using (public.user_has_cashier_access(cashier_id));

-- ============================================================
-- DEDUCTION EVENT
-- ============================================================
create policy "de_select_access" on public.deduction_event
  for select to authenticated
  using (
    exists (
      select 1 from public.assessment a
      where a.id = assessment_id and public.user_has_cashier_access(a.cashier_id)
    )
  );

create policy "de_insert_access" on public.deduction_event
  for insert to authenticated
  with check (
    exists (
      select 1 from public.assessment a
      where a.id = assessment_id and public.user_has_cashier_access(a.cashier_id)
    )
  );

create policy "de_delete_access" on public.deduction_event
  for delete to authenticated
  using (
    exists (
      select 1 from public.assessment a
      where a.id = assessment_id and public.user_has_cashier_access(a.cashier_id)
    )
  );

-- ============================================================
-- CASHIER PERIOD SCORE
-- ============================================================
create policy "cps_select_access" on public.cashier_period_score
  for select to authenticated
  using (public.user_has_cashier_access(cashier_id));

-- write via server/service role

-- ============================================================
-- LEADERBOARD ENTRY
-- ============================================================
create policy "le_select_auth" on public.leaderboard_entry
  for select to authenticated
  using (true);

-- write via server/service role

-- ============================================================
-- CASHIER CUMULATIVE SCORE
-- ============================================================
create policy "ccs_select_access" on public.cashier_cumulative_score
  for select to authenticated
  using (public.user_has_cashier_access(cashier_id));

-- write via server/service role

-- ============================================================
-- MENTORING SESSION
-- ============================================================
create policy "ms_select_access" on public.mentoring_session
  for select to authenticated
  using (public.user_has_outlet_access(outlet_id));

create policy "ms_insert_access" on public.mentoring_session
  for insert to authenticated
  with check (public.user_has_outlet_access(outlet_id));

create policy "ms_update_access" on public.mentoring_session
  for update to authenticated
  using (public.user_has_outlet_access(outlet_id))
  with check (public.user_has_outlet_access(outlet_id));

create policy "ms_delete_access" on public.mentoring_session
  for delete to authenticated
  using (public.user_has_outlet_access(outlet_id));

-- ============================================================
-- MENTORING CASHIER NOTE
-- ============================================================
create policy "mcn_select_access" on public.mentoring_cashier_note
  for select to authenticated
  using (
    exists (
      select 1 from public.mentoring_session s
      where s.id = session_id and public.user_has_outlet_access(s.outlet_id)
    )
    or public.user_has_cashier_access(cashier_id)
  );

create policy "mcn_insert_access" on public.mentoring_cashier_note
  for insert to authenticated
  with check (
    exists (
      select 1 from public.mentoring_session s
      where s.id = session_id and public.user_has_outlet_access(s.outlet_id)
    )
  );

create policy "mcn_update_access" on public.mentoring_cashier_note
  for update to authenticated
  using (
    exists (
      select 1 from public.mentoring_session s
      where s.id = session_id and public.user_has_outlet_access(s.outlet_id)
    )
  )
  with check (
    exists (
      select 1 from public.mentoring_session s
      where s.id = session_id and public.user_has_outlet_access(s.outlet_id)
    )
  );

create policy "mcn_delete_access" on public.mentoring_cashier_note
  for delete to authenticated
  using (
    exists (
      select 1 from public.mentoring_session s
      where s.id = session_id and public.user_has_outlet_access(s.outlet_id)
    )
  );

-- ============================================================
-- INVITE
-- ============================================================
create policy "invite_select_admin" on public.invite
  for select to authenticated
  using (public.is_admin());

create policy "invite_insert_admin" on public.invite
  for insert to authenticated
  with check (public.is_admin());

create policy "invite_update_admin" on public.invite
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- token diakses via endpoint server (service role), bukan publik langsung

-- ============================================================
-- NOTIFICATION
-- ============================================================
create policy "notification_select_own" on public.notification
  for select to authenticated
  using (user_id = auth.uid());

create policy "notification_update_own" on public.notification
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- insert via server/service role

-- ============================================================
-- PERIOD LOG
-- ============================================================
create policy "period_log_select_auth" on public.period_log
  for select to authenticated
  using (true);