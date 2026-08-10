-- ============================================================
-- Security regression suite
--
-- Jalankan melalui `npm run test:security`.
-- Semua fixture dibuat di dalam satu transaksi dan selalu di-ROLLBACK.
-- Suite ini sengaja memakai role database `authenticated`/`anon` dengan
-- JWT claim lokal agar menguji RLS, grant kolom, dan function privilege.
-- ============================================================

\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(p_condition boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if coalesce(p_condition, false) is false then
    raise exception 'SECURITY REGRESSION: %', p_message;
  end if;
end;
$$;

create or replace function pg_temp.expect_denied(p_sql text, p_message text)
returns void
language plpgsql
as $$
declare
  v_state text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate;
    if v_state = '42501' then
      return;
    end if;
    raise;
  end;

  raise exception 'SECURITY REGRESSION: operasi seharusnya ditolak: %', p_message;
end;
$$;

create or replace function pg_temp.expect_error(p_sql text, p_message text, p_fragment text)
returns void
language plpgsql
as $$
declare
  v_state text;
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics
      v_state = returned_sqlstate,
      v_message = message_text;
    if position(lower(p_fragment) in lower(v_message)) > 0 then
      return;
    end if;
    raise exception 'SECURITY REGRESSION: error tidak sesuai untuk %: [%] %', p_message, v_state, v_message;
  end;

  raise exception 'SECURITY REGRESSION: operasi seharusnya menghasilkan error: %', p_message;
end;
$$;

create or replace function pg_temp.expect_no_rows(p_sql text, p_message text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  execute p_sql;
  get diagnostics v_count = row_count;
  if v_count <> 0 then
    raise exception 'SECURITY REGRESSION: operasi seharusnya tidak mengubah baris: %', p_message;
  end if;
end;
$$;

-- ---------- Deterministic fixtures ----------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'security-admin@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Admin"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'security-manager-a@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Manager A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'security-manager-b@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Manager B"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'security-supervisor-a@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Supervisor A"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'security-inactive@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Inactive"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'security-pending@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Pending"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'security-expired@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Expired"}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'security-setup@example.test', crypt('security-regression', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Security Setup"}'::jsonb, now(), now());

update public.users
set role = case id
    when '10000000-0000-0000-0000-000000000001' then 'admin'::public.user_role
    when '10000000-0000-0000-0000-000000000002' then 'manager'::public.user_role
    when '10000000-0000-0000-0000-000000000003' then 'manager'::public.user_role
    when '10000000-0000-0000-0000-000000000004' then 'supervisor'::public.user_role
    else 'manager'::public.user_role
  end,
  is_active = id <> '10000000-0000-0000-0000-000000000005',
  full_name = 'Security Fixture ' || right(id::text, 1)
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005'
);

insert into public.branch (id, name, code)
values
  ('20000000-0000-0000-0000-000000000001', 'Security Branch A', 'SEC-A'),
  ('20000000-0000-0000-0000-000000000002', 'Security Branch B', 'SEC-B');

insert into public.outlet (id, branch_id, name)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Security Outlet A'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Security Outlet B');

insert into public.cashier (id, name, outlet_id)
values
  ('40000000-0000-0000-0000-000000000001', 'Security Cashier A', '30000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'Security Cashier B', '30000000-0000-0000-0000-000000000002');

insert into public.cashier_outlet_history (id, cashier_id, outlet_id, started_at)
values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now() - interval '7 days'),
  ('41000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', now() - interval '7 days');

insert into public.user_branch (user_id, branch_id)
values
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001');

insert into public.invite (id, invite_name, email, role, token, branch_ids, expires_at, created_by)
values
  ('d0000000-0000-0000-0000-000000000001', 'Atomic Invite', null, 'manager', 'security-invite-token-000000000001', array['20000000-0000-0000-0000-000000000001'::uuid], now() + interval '7 days', '10000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', 'Revocable Invite', null, 'supervisor', 'security-invite-token-000000000002', array['20000000-0000-0000-0000-000000000001'::uuid], now() + interval '7 days', '10000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000003', 'Regenerable Invite', null, 'supervisor', 'security-invite-token-000000000003', array['20000000-0000-0000-0000-000000000001'::uuid], now() + interval '7 days', '10000000-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000004', 'Expired Invite', null, 'manager', 'security-invite-token-000000000004', array['20000000-0000-0000-0000-000000000001'::uuid], now() - interval '1 minute', '10000000-0000-0000-0000-000000000001');

-- Isolate the fixture from the development open period; the transaction rolls this back.
update public.period set status = 'closed', closed_at = now() where status = 'open';

insert into public.period (id, label, start_date, end_date, status)
values
  ('70000000-0000-0000-0000-000000000001', 'SECURITY-OPEN', current_date - 1, current_date + 30, 'open'),
  ('70000000-0000-0000-0000-000000000002', 'SECURITY-CLOSED', current_date - 60, current_date - 30, 'closed');

-- Isolasi konfigurasi scoring agar test proposed total deterministik terhadap
-- data development yang sudah ada di database lokal.
update public.detail set is_active = false;
update public.category set is_active = false;

insert into public.category (id, name, weight)
values ('50000000-0000-0000-0000-000000000001', 'Security Category', 100);

insert into public.detail (id, category_id, name, type, scale_max)
values ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Security Scale', 'scale', 10);

insert into public.detail (id, category_id, name, type, deduction_points)
values ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Security Deduction', 'deduction', 5);

insert into public.category_weight_history (period_id, category_id, weight, category_name)
values ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 100, 'Security Category');

insert into public.detail_config_history (
  period_id, detail_id, scale_max, deduction_points, category_id, detail_name, detail_type
)
values
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 10, null, '50000000-0000-0000-0000-000000000001', 'Security Scale', 'scale'),
  ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', null, 5, '50000000-0000-0000-0000-000000000001', 'Security Deduction', 'deduction');

insert into public.cashier_period_roster (
  period_id, cashier_id, outlet_id, branch_id,
  cashier_name, outlet_name, branch_name, eligible_from, entry_reason
)
values
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Security Cashier A', 'Security Outlet A', 'Security Branch A', current_date, 'security_fixture'),
  ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Security Cashier B', 'Security Outlet B', 'Security Branch B', current_date, 'security_fixture');

insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
values
  ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', null, 100, '10000000-0000-0000-0000-000000000002'),
  ('80000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002', null, 100, '10000000-0000-0000-0000-000000000003');

insert into public.deduction_event (id, assessment_id, note, points, created_by)
values ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'Security cross-branch fixture', 1, '10000000-0000-0000-0000-000000000003');

insert into public.leaderboard_entry (id, period_id, cashier_id, outlet_id, branch_id, total_score, rank_global)
values
  ('c0000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 90, 1),
  ('c0000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 80, 2);

insert into public.mentoring_session (id, outlet_id, conducted_by, visited_date, note_outlet)
values ('a0000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', current_date, 'Security cross-branch fixture');

-- Permission state is restored by the transaction rollback.
update public.role_permission
set enabled = case
  when role = 'admin' then true
  when role = 'manager' then permission in (
    'assessment', 'leaderboard', 'mentoring', 'branches.view',
    'outlets.view', 'outlets.create', 'outlets.update',
    'cashiers.view', 'cashiers.create', 'cashiers.update',
    'cashier_photos.view', 'notifications'
  )
  when role = 'supervisor' then permission in (
    'assessment', 'leaderboard', 'mentoring', 'branches.view',
    'outlets.view', 'cashiers.view', 'cashier_photos.view', 'notifications'
  )
  else false
end;

select pg_temp.assert_true(
  (select status = 'in_progress'
     and total_details = 2
     and assessed_details = 1
   from public.cashier_period_completion
   where period_id = '70000000-0000-0000-0000-000000000001'
     and cashier_id = '40000000-0000-0000-0000-000000000002')
  and (select total_score < 100
       from public.cashier_period_score
       where period_id = '70000000-0000-0000-0000-000000000001'
         and cashier_id = '40000000-0000-0000-0000-000000000002'),
  'detail yang hilang tidak boleh dianggap full credit dan completion harus partial'
);

delete from public.assessment
where id = '80000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select status = 'not_started'
     and total_details = 2
     and assessed_details = 0
   from public.cashier_period_completion
   where period_id = '70000000-0000-0000-0000-000000000001'
     and cashier_id = '40000000-0000-0000-0000-000000000001'),
  'cashier-period tanpa assessment harus not_started'
);
insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
values ('80000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', null, 100, '10000000-0000-0000-0000-000000000002');

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.open_period(date,date,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.open_period(date,date,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.open_period(date,date,uuid)', 'execute'),
  'open_period privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.close_period(uuid,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.close_period(uuid,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.close_period(uuid,uuid)', 'execute'),
  'close_period privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.recalculate_cashier_period_score(uuid,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.recalculate_cashier_period_score(uuid,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.recalculate_cashier_period_score(uuid,uuid)', 'execute'),
  'recalculate privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.admin_update_user(uuid,uuid,public.user_role,boolean,text)', 'execute') = false
  and has_function_privilege('authenticated', 'public.admin_update_user(uuid,uuid,public.user_role,boolean,text)', 'execute') = false
  and has_function_privilege('service_role', 'public.admin_update_user(uuid,uuid,public.user_role,boolean,text)', 'execute'),
  'admin_update_user privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.consume_invite(text,uuid,text,text)', 'execute') = false
  and has_function_privilege('authenticated', 'public.consume_invite(text,uuid,text,text)', 'execute') = false
  and has_function_privilege('service_role', 'public.consume_invite(text,uuid,text,text)', 'execute'),
  'consume_invite privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.revoke_invite(uuid,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.revoke_invite(uuid,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.revoke_invite(uuid,uuid)', 'execute'),
  'revoke_invite privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.regenerate_invite(uuid,uuid,text,timestamptz)', 'execute') = false
  and has_function_privilege('authenticated', 'public.regenerate_invite(uuid,uuid,text,timestamptz)', 'execute') = false
  and has_function_privilege('service_role', 'public.regenerate_invite(uuid,uuid,text,timestamptz)', 'execute'),
  'regenerate_invite privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.reserve_setup(uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.reserve_setup(uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.reserve_setup(uuid)', 'execute')
  and has_function_privilege('anon', 'public.finalize_setup(uuid,uuid,text,text)', 'execute') = false
  and has_function_privilege('authenticated', 'public.finalize_setup(uuid,uuid,text,text)', 'execute') = false
  and has_function_privilege('service_role', 'public.finalize_setup(uuid,uuid,text,text)', 'execute')
  and has_function_privilege('anon', 'public.release_setup(uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.release_setup(uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.release_setup(uuid)', 'execute'),
  'setup lifecycle privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.create_cashier_with_history(text,uuid,date,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.create_cashier_with_history(text,uuid,date,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.create_cashier_with_history(text,uuid,date,uuid)', 'execute'),
  'create_cashier_with_history privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.transfer_cashier_atomic(uuid,uuid,timestamptz,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.transfer_cashier_atomic(uuid,uuid,timestamptz,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.transfer_cashier_atomic(uuid,uuid,timestamptz,uuid)', 'execute'),
  'transfer_cashier_atomic privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.create_mentoring_session_atomic(uuid,uuid,date,text,jsonb)', 'execute') = false
  and has_function_privilege('authenticated', 'public.create_mentoring_session_atomic(uuid,uuid,date,text,jsonb)', 'execute') = false
  and has_function_privilege('service_role', 'public.create_mentoring_session_atomic(uuid,uuid,date,text,jsonb)', 'execute'),
  'create_mentoring_session_atomic privilege harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.set_cashier_status_atomic(uuid,boolean,text,timestamptz,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.set_cashier_status_atomic(uuid,boolean,text,timestamptz,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.set_cashier_status_atomic(uuid,boolean,text,timestamptz,uuid)', 'execute')
  and has_function_privilege('anon', 'public.set_outlet_status_guarded(uuid,boolean,text,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.set_outlet_status_guarded(uuid,boolean,text,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.set_outlet_status_guarded(uuid,boolean,text,uuid)', 'execute')
  and has_function_privilege('anon', 'public.set_branch_status_guarded(uuid,boolean,text,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.set_branch_status_guarded(uuid,boolean,text,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.set_branch_status_guarded(uuid,boolean,text,uuid)', 'execute'),
  'cashier dan parent status RPC harus service_role-only'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.admin_create_category(uuid,text,numeric)', 'execute') = false
  and has_function_privilege('authenticated', 'public.admin_create_category(uuid,text,numeric)', 'execute') = false
  and has_function_privilege('service_role', 'public.admin_create_category(uuid,text,numeric)', 'execute')
  and has_function_privilege('anon', 'public.admin_update_category(uuid,uuid,text,numeric,boolean)', 'execute') = false
  and has_function_privilege('authenticated', 'public.admin_update_category(uuid,uuid,text,numeric,boolean)', 'execute') = false
  and has_function_privilege('service_role', 'public.admin_update_category(uuid,uuid,text,numeric,boolean)', 'execute')
  and has_function_privilege('anon', 'public.admin_create_detail(uuid,uuid,text,public.detail_type,numeric,numeric)', 'execute') = false
  and has_function_privilege('authenticated', 'public.admin_create_detail(uuid,uuid,text,public.detail_type,numeric,numeric)', 'execute') = false
  and has_function_privilege('service_role', 'public.admin_create_detail(uuid,uuid,text,public.detail_type,numeric,numeric)', 'execute')
  and has_function_privilege('anon', 'public.admin_set_category_status(uuid,uuid,boolean,text)', 'execute') = false
  and has_function_privilege('authenticated', 'public.admin_set_category_status(uuid,uuid,boolean,text)', 'execute') = false
  and has_function_privilege('service_role', 'public.admin_set_category_status(uuid,uuid,boolean,text)', 'execute')
  and has_function_privilege('anon', 'public.admin_set_detail_status(uuid,uuid,boolean,text)', 'execute') = false
  and has_function_privilege('authenticated', 'public.admin_set_detail_status(uuid,uuid,boolean,text)', 'execute') = false
  and has_function_privilege('service_role', 'public.admin_set_detail_status(uuid,uuid,boolean,text)', 'execute'),
  'category/detail configuration RPC harus service_role-only'
);

select pg_temp.assert_true(
  (select public = false
   and file_size_limit = 2097152
   and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[]
   from storage.buckets
   where id = 'cashier-photos'),
  'bucket foto kasir harus private dengan batas 2 MB dan MIME image yang diizinkan'
);

select pg_temp.assert_true(
  (select role = 'supervisor' and is_active = false
   from public.users
   where id = '10000000-0000-0000-0000-000000000006'),
  'Auth user baru harus menghasilkan profile supervisor nonaktif'
);

-- ---------- Race-safe initial setup ----------
update public.app_setup
set admin_created = false,
    completed_at = null,
    setup_claim_id = null,
    setup_claimed_at = null,
    setup_attempt_count = 0,
    setup_attempt_window_at = null;
update public.users
set role = 'supervisor',
    is_active = false
where role = 'admin';
update public.users
set role = 'supervisor',
    is_active = false
where id = '10000000-0000-0000-0000-000000000001';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.reserve_setup('e0000000-0000-0000-0000-000000000001');
select pg_temp.expect_error(
  $$select public.reserve_setup('e0000000-0000-0000-0000-000000000002')$$,
  'request setup kedua harus menunggu claim pertama',
  'sedang diproses'
);
select public.release_setup('e0000000-0000-0000-0000-000000000001');

select public.reserve_setup('e0000000-0000-0000-0000-000000000002');
select public.release_setup('e0000000-0000-0000-0000-000000000002');
select public.reserve_setup('e0000000-0000-0000-0000-000000000003');
select public.release_setup('e0000000-0000-0000-0000-000000000003');
select public.reserve_setup('e0000000-0000-0000-0000-000000000004');
select public.release_setup('e0000000-0000-0000-0000-000000000004');
select public.reserve_setup('e0000000-0000-0000-0000-000000000005');
select public.release_setup('e0000000-0000-0000-0000-000000000005');
select pg_temp.expect_error(
  $$select public.reserve_setup('e0000000-0000-0000-0000-000000000006')$$,
  'setup harus memiliki rate limit percobaan',
  'Terlalu banyak'
);

update public.app_setup
set setup_attempt_count = 0,
    setup_attempt_window_at = now(),
    setup_claim_id = null,
    setup_claimed_at = null;
select public.reserve_setup('e0000000-0000-0000-0000-000000000006');
select (public.finalize_setup(
  'e0000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000008',
  'security-setup@example.test',
  'Security Setup Admin'
)).id;
select pg_temp.assert_true(
  (select admin_created and completed_at is not null and setup_claim_id is null
   from public.app_setup)
  and (select role = 'admin' and is_active and full_name = 'Security Setup Admin'
       from public.users
       where id = '10000000-0000-0000-0000-000000000008'),
  'setup finalize harus membuat admin pertama dan membersihkan claim'
);
update public.users
set role = 'admin',
    is_active = true
where id = '10000000-0000-0000-0000-000000000001';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select pg_temp.expect_denied(
  $$select public.reserve_setup('e0000000-0000-0000-0000-000000000007')$$,
  'role authenticated tidak boleh menjalankan reserve_setup'
);
select pg_temp.expect_denied(
  $$select public.finalize_setup('e0000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000008', 'security-setup@example.test', 'Unauthorized')$$,
  'role authenticated tidak boleh menjalankan finalize_setup'
);
reset role;

-- ---------- Atomic cashier create ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select (public.create_cashier_with_history(
  'Security Atomic Cashier',
  '30000000-0000-0000-0000-000000000001',
  current_date,
  '10000000-0000-0000-0000-000000000002'
)).id;
select pg_temp.assert_true(
  (select count(*) = 1
   from public.cashier
   where name = 'Security Atomic Cashier'
     and outlet_id = '30000000-0000-0000-0000-000000000001')
  and (select count(*) = 1
       from public.cashier_outlet_history h
       join public.cashier c on c.id = h.cashier_id
       where c.name = 'Security Atomic Cashier'
         and h.outlet_id = '30000000-0000-0000-0000-000000000001'
         and h.ended_at is null),
  'create cashier harus membuat cashier dan satu history aktif'
);
select pg_temp.expect_error(
  $$select public.create_cashier_with_history('Security Cross Branch Cashier', '30000000-0000-0000-0000-000000000002', current_date, '10000000-0000-0000-0000-000000000002')$$,
  'manager A tidak boleh membuat kasir di branch B',
  'akses ke cabang'
);
select pg_temp.expect_error(
  $$select public.create_cashier_with_history('Security Supervisor Cashier', '30000000-0000-0000-0000-000000000001', current_date, '10000000-0000-0000-0000-000000000004')$$,
  'supervisor tanpa permission tidak boleh membuat kasir',
  'permission membuat kasir'
);
select pg_temp.expect_error(
  $$select public.create_cashier_with_history('Security Future Cashier', '30000000-0000-0000-0000-000000000001', current_date + 1, '10000000-0000-0000-0000-000000000002')$$,
  'tanggal mulai kerja masa depan harus ditolak',
  'Data kasir tidak valid'
);
reset role;

-- ---------- Atomic cashier transfer ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select (public.transfer_cashier_atomic(
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  now(),
  '10000000-0000-0000-0000-000000000001'
)).id;
select pg_temp.assert_true(
  (select outlet_id = '30000000-0000-0000-0000-000000000002'
   from public.cashier
   where id = '40000000-0000-0000-0000-000000000001')
  and (select count(*) = 1
       from public.cashier_outlet_history
       where cashier_id = '40000000-0000-0000-0000-000000000001'
         and outlet_id = '30000000-0000-0000-0000-000000000001'
         and ended_at is not null)
  and (select count(*) = 1
       from public.cashier_outlet_history
       where cashier_id = '40000000-0000-0000-0000-000000000001'
         and outlet_id = '30000000-0000-0000-0000-000000000002'
         and ended_at is null),
  'transfer harus menutup history lama dan membuat history target aktif'
);
select pg_temp.expect_error(
  $$select public.transfer_cashier_atomic('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', now(), '10000000-0000-0000-0000-000000000001')$$,
  'transfer ke outlet yang sama harus ditolak',
  'tujuan sama'
);
update public.outlet set is_active = false where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.expect_error(
  $$select public.transfer_cashier_atomic('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now(), '10000000-0000-0000-0000-000000000001')$$,
  'transfer ke outlet nonaktif harus ditolak',
  'tidak aktif'
);
update public.outlet set is_active = true where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.expect_error(
  $$select public.transfer_cashier_atomic('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now() - interval '1 day', '10000000-0000-0000-0000-000000000001')$$,
  'effective date sebelum history aktif harus ditolak',
  'setelah awal'
);
select pg_temp.expect_error(
  $$select public.transfer_cashier_atomic('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now(), '10000000-0000-0000-0000-000000000002')$$,
  'manager tidak boleh menjalankan transfer admin',
  'Actor transfer'
);
update public.cashier_outlet_history
set ended_at = now()
where cashier_id = '40000000-0000-0000-0000-000000000001'
  and outlet_id = '30000000-0000-0000-0000-000000000002'
  and ended_at is null;
update public.cashier
set outlet_id = '30000000-0000-0000-0000-000000000001'
where id = '40000000-0000-0000-0000-000000000001';
insert into public.cashier_outlet_history (cashier_id, outlet_id, started_at)
values ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', now());
reset role;

-- ---------- Atomic mentoring session ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select (public.create_mentoring_session_atomic(
  '30000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  current_date,
  'Security Atomic Mentoring',
  '[{"cashierId":"40000000-0000-0000-0000-000000000001","note":"Catatan valid"}]'::jsonb
)).id;
select pg_temp.assert_true(
  (select count(*) = 1
   from public.mentoring_session
   where note_outlet = 'Security Atomic Mentoring')
  and (select count(*) = 1
       from public.mentoring_cashier_note n
       join public.mentoring_session s on s.id = n.session_id
       where s.note_outlet = 'Security Atomic Mentoring'
         and n.cashier_id = '40000000-0000-0000-0000-000000000001'
         and n.note = 'Catatan valid'),
  'mentoring atomic harus membuat session dan note terkait'
);
select pg_temp.expect_error(
  $$select public.create_mentoring_session_atomic('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', current_date, 'Security Duplicate Notes', '[{"cashierId":"40000000-0000-0000-0000-000000000001","note":"Satu"},{"cashierId":"40000000-0000-0000-0000-000000000001","note":"Dua"}]'::jsonb)$$,
  'duplicate cashier note harus ditolak sebelum session dibuat',
  'tidak boleh duplikat'
);
select pg_temp.assert_true(
  not exists (select 1 from public.mentoring_session where note_outlet = 'Security Duplicate Notes'),
  'session duplicate note tidak boleh tersisa setelah rollback'
);
select pg_temp.expect_error(
  $$select public.create_mentoring_session_atomic('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', current_date, 'Security Cross Cashier Note', '[{"cashierId":"40000000-0000-0000-0000-000000000002","note":"Cross branch"}]'::jsonb)$$,
  'note cashier harus sesuai outlet session',
  'tidak sesuai outlet'
);
update public.cashier set is_active = false where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.expect_error(
  $$select public.create_mentoring_session_atomic('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', current_date, 'Security Inactive Note', '[{"cashierId":"40000000-0000-0000-0000-000000000001","note":"Inactive"}]'::jsonb)$$,
  'cashier inactive tidak boleh diberi note',
  'tidak aktif'
);
update public.cashier set is_active = true where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.expect_error(
  $$select public.create_mentoring_session_atomic('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', current_date + 1, 'Security Future Session', '[]'::jsonb)$$,
  'tanggal mentoring masa depan harus ditolak',
  'Data pendampingan tidak valid'
);
reset role;

-- ---------- Cashier lifecycle ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select pg_temp.expect_error(
  $$select public.set_cashier_status_atomic('40000000-0000-0000-0000-000000000001', false, 'Tanggal tidak valid', now() - interval '30 days', '10000000-0000-0000-0000-000000000001')$$,
  'status dengan effective date sebelum history terakhir harus ditolak',
  'aktivitas penempatan terakhir'
);

select (public.set_cashier_status_atomic(
  '40000000-0000-0000-0000-000000000001',
  false,
  'Kontrak kerja berakhir',
  null,
  '10000000-0000-0000-0000-000000000001'
)).id;
select pg_temp.assert_true(
  (select is_active = false from public.cashier where id = '40000000-0000-0000-0000-000000000001')
  and (select count(*) = 0
       from public.cashier_outlet_history
       where cashier_id = '40000000-0000-0000-0000-000000000001'
         and ended_at is null)
  and (select is_active = false
       and reason = 'Kontrak kerja berakhir'
       and changed_by = '10000000-0000-0000-0000-000000000001'
       from public.cashier_status_history
       where cashier_id = '40000000-0000-0000-0000-000000000001'
       order by effective_at desc
       limit 1),
  'deaktivasi harus atomik, menutup placement, dan mencatat reason/actor'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  (select count(*) = 1 from public.cashier where id = '40000000-0000-0000-0000-000000000001')
  and (select count(*) > 0 from public.cashier_outlet_history
       where cashier_id = '40000000-0000-0000-0000-000000000001'),
  'admin harus dapat melihat kasir dan history nonaktif untuk audit'
);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true(
  (select count(*) = 0 from public.cashier where id = '40000000-0000-0000-0000-000000000001'),
  'manager tidak boleh melihat kasir nonaktif'
);
select pg_temp.expect_denied(
  $$select public.set_cashier_status_atomic('40000000-0000-0000-0000-000000000001', true, 'Unauthorized', null, '10000000-0000-0000-0000-000000000002')$$,
  'manager tidak boleh menjalankan status RPC'
);
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select pg_temp.expect_error(
  $$select public.set_outlet_status_guarded('30000000-0000-0000-0000-000000000002', false, 'Outlet masih dipakai', '10000000-0000-0000-0000-000000000001')$$,
  'outlet dengan cashier aktif harus ditolak',
  'masih memiliki kasir aktif'
);
select pg_temp.expect_error(
  $$select public.set_branch_status_guarded('20000000-0000-0000-0000-000000000002', false, 'Cabang masih dipakai', '10000000-0000-0000-0000-000000000001')$$,
  'cabang dengan cashier aktif harus ditolak',
  'masih memiliki kasir aktif'
);

select public.set_cashier_status_atomic(
  '40000000-0000-0000-0000-000000000002', false, 'Penonaktifan sementara', null,
  '10000000-0000-0000-0000-000000000001'
);
select public.set_outlet_status_guarded(
  '30000000-0000-0000-0000-000000000002', false, 'Outlet ditutup sementara',
  '10000000-0000-0000-0000-000000000001'
);
select public.set_branch_status_guarded(
  '20000000-0000-0000-0000-000000000002', false, 'Cabang ditutup sementara',
  '10000000-0000-0000-0000-000000000001'
);
select pg_temp.assert_true(
  (select not is_active from public.branch where id = '20000000-0000-0000-0000-000000000002')
  and (select not is_active from public.outlet where id = '30000000-0000-0000-0000-000000000002')
  and (select not is_active from public.cashier where id = '40000000-0000-0000-0000-000000000002'),
  'parent status harus dapat dinonaktifkan setelah cashier nonaktif'
);

select public.set_branch_status_guarded(
  '20000000-0000-0000-0000-000000000002', true, 'Cabang dibuka kembali',
  '10000000-0000-0000-0000-000000000001'
);
select public.set_outlet_status_guarded(
  '30000000-0000-0000-0000-000000000002', true, 'Outlet dibuka kembali',
  '10000000-0000-0000-0000-000000000001'
);
select public.set_cashier_status_atomic(
  '40000000-0000-0000-0000-000000000002', true, 'Kembali bekerja', null,
  '10000000-0000-0000-0000-000000000001'
);
select pg_temp.assert_true(
  (select is_active from public.cashier where id = '40000000-0000-0000-0000-000000000002')
  and (select count(*) = 1 from public.cashier_outlet_history
       where cashier_id = '40000000-0000-0000-0000-000000000002'
         and ended_at is null)
  and (select count(*) >= 2 from public.cashier_status_history
       where cashier_id = '40000000-0000-0000-0000-000000000002'),
  'reaktivasi harus membuat placement baru dan history status'
);
select public.set_cashier_status_atomic(
  '40000000-0000-0000-0000-000000000001', true, 'Kembali ke status aktif', null,
  '10000000-0000-0000-0000-000000000001'
);
reset role;

-- ---------- Category configuration validation ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

update public.category
set weight = 40
where id = '50000000-0000-0000-0000-000000000001';
select (public.admin_create_category(
  '10000000-0000-0000-0000-000000000001', 'Security Draft Category', 35
)).id;
select pg_temp.assert_true(
  (select coalesce(sum(weight), 0) = 75 from public.category where is_active = true),
  'create category harus mengizinkan konfigurasi bobot sementara di bawah 100'
);
select (public.admin_create_category(
  '10000000-0000-0000-0000-000000000001', 'Security Completing Category', 25
)).id;
select pg_temp.assert_true(
  (select count(*) = 3 from public.category where is_active = true and weight > 0)
  and (select coalesce(sum(weight), 0) = 100 from public.category where is_active = true),
  'kategori dapat dilengkapi bertahap sampai total 100'
);
select pg_temp.expect_error(
  $$select public.admin_create_category('10000000-0000-0000-0000-000000000001', 'Security Overflow Category', 1)$$,
  'create category yang membuat total lebih dari 100 harus ditolak',
  'melebihi 100'
);
select (public.admin_update_category(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  null, 30, null
)).id;
select pg_temp.assert_true(
  (select coalesce(sum(weight), 0) = 90 from public.category where is_active = true),
  'update category harus mengizinkan konfigurasi bobot sementara di bawah 100'
);
delete from public.category where name in ('Security Draft Category', 'Security Completing Category');
update public.category
set weight = 100,
    name = 'Security Category'
where id = '50000000-0000-0000-0000-000000000001';

select (public.admin_update_category(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Security Category Renamed', null, null
)).id;
select pg_temp.assert_true(
  (select name = 'Security Category Renamed' and weight = 100
   from public.category where id = '50000000-0000-0000-0000-000000000001'),
  'update category name harus mempertahankan konfigurasi bobot valid'
);
update public.category set name = 'Security Category'
where id = '50000000-0000-0000-0000-000000000001';

select (public.admin_create_detail(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  'Security Added Detail',
  'scale'::public.detail_type,
  5,
  null
)).id;
select pg_temp.assert_true(
  (select count(*) = 1 from public.detail where name = 'Security Added Detail' and scale_max = 5),
  'create detail harus menyimpan konfigurasi scale yang valid'
);
select pg_temp.expect_error(
  $$select public.admin_create_detail('10000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Security Invalid Detail', 'scale'::public.detail_type, null, null)$$,
  'detail scale tanpa scale_max harus ditolak',
  'scale_max positif'
);
delete from public.detail where name = 'Security Added Detail';

-- ---------- Assessment configuration archive ----------
create temp table category_archive_baseline as
select
  (select count(*) from public.category_weight_history
   where category_id = '50000000-0000-0000-0000-000000000001') as category_snapshot_count,
  (select count(*) from public.detail_config_history
   where category_id = '50000000-0000-0000-0000-000000000001') as detail_snapshot_count,
  (select count(*) from public.assessment
   where cashier_id = '40000000-0000-0000-0000-000000000001') as assessment_count,
  (select coalesce(sum(normalized_score), 0) from public.assessment
   where cashier_id = '40000000-0000-0000-0000-000000000001') as assessment_score_sum,
  (select count(*) from public.deduction_event de
   join public.assessment a on a.id = de.assessment_id
   where a.cashier_id = '40000000-0000-0000-0000-000000000001') as deduction_count,
  (select md5(category_scores::text)
   from public.cashier_period_score
   where period_id = '70000000-0000-0000-0000-000000000001'
     and cashier_id = '40000000-0000-0000-0000-000000000001') as score_hash;

select public.admin_set_category_status(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  false,
  'Uji arsip kategori security'
);
select pg_temp.assert_true(
  (select is_active = false from public.category
   where id = '50000000-0000-0000-0000-000000000001')
  and (select count(*) = 1 from public.audit_log
       where entity_type = 'category'
         and entity_id = '50000000-0000-0000-0000-000000000001'
         and action = 'category.archived'
         and after_data ->> 'reason' = 'Uji arsip kategori security'),
  'archive kategori harus mengubah status dan mencatat audit'
);

select public.admin_set_category_status(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  true,
  'Uji pemulihan kategori security'
);
select public.admin_set_detail_status(
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  false,
  'Uji arsip detail security'
);
select public.admin_set_detail_status(
  '10000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  true,
  'Uji pemulihan detail security'
);
select public.admin_set_category_status(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  false,
  'Uji parent archived security'
);
select pg_temp.expect_error(
  $$select public.admin_set_detail_status(
    '10000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    true,
    'Restore detail tanpa parent')$$,
  'restore detail pada parent archived harus ditolak',
  'parent masih diarsipkan'
);
select public.admin_set_category_status(
  '10000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  true,
  'Uji pemulihan parent security'
);

select pg_temp.expect_error(
  $$delete from public.category where id = '50000000-0000-0000-0000-000000000001'$$,
  'hard delete kategori yang memiliki detail harus ditolak',
  'violates foreign key constraint'
);
select pg_temp.expect_error(
  $$delete from public.detail where id = '60000000-0000-0000-0000-000000000001'$$,
  'hard delete detail yang memiliki assessment harus ditolak',
  'violates foreign key constraint'
);
select pg_temp.assert_true(
  (select category_snapshot_count from category_archive_baseline) =
    (select count(*) from public.category_weight_history
     where category_id = '50000000-0000-0000-0000-000000000001')
  and (select detail_snapshot_count from category_archive_baseline) =
    (select count(*) from public.detail_config_history
     where category_id = '50000000-0000-0000-0000-000000000001')
  and (select assessment_count from category_archive_baseline) =
    (select count(*) from public.assessment
     where cashier_id = '40000000-0000-0000-0000-000000000001')
  and (select assessment_score_sum from category_archive_baseline) =
    (select coalesce(sum(normalized_score), 0) from public.assessment
     where cashier_id = '40000000-0000-0000-0000-000000000001')
  and (select deduction_count from category_archive_baseline) =
    (select count(*) from public.deduction_event de
     join public.assessment a on a.id = de.assessment_id
     where a.cashier_id = '40000000-0000-0000-0000-000000000001')
  and (select score_hash from category_archive_baseline) =
    (select md5(category_scores::text)
     from public.cashier_period_score
     where period_id = '70000000-0000-0000-0000-000000000001'
       and cashier_id = '40000000-0000-0000-0000-000000000001'),
  'archive restore tidak boleh mengubah snapshot assessment atau score'
);

update public.category set weight = 99
where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.expect_error(
  $$select public.open_period((current_date + 45)::date, (current_date + 75)::date, '10000000-0000-0000-0000-000000000001')$$,
  'open period dengan total kategori tidak 100 harus ditolak',
  'harus 100'
);
update public.category set weight = 100
where id = '50000000-0000-0000-0000-000000000001';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select pg_temp.expect_denied(
  $$insert into public.category (name, weight) values ('Direct Category Write', 100)$$,
  'authenticated tidak boleh menulis category secara langsung'
);
select pg_temp.expect_denied(
  $$update public.category set weight = 99 where id = '50000000-0000-0000-0000-000000000001'$$,
  'authenticated tidak boleh mengubah weight category secara langsung'
);
select pg_temp.expect_denied(
  $$insert into public.detail (category_id, name, type, scale_max) values ('50000000-0000-0000-0000-000000000001', 'Direct Detail Write', 'scale', 5)$$,
  'authenticated tidak boleh menulis detail secara langsung'
);
select pg_temp.expect_denied(
  $$select public.admin_set_category_status(
    '10000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    false,
    'Unauthorized archive')$$,
  'authenticated tidak boleh memanggil RPC archive kategori'
);
select pg_temp.expect_denied(
  $$select public.admin_set_detail_status(
    '10000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    false,
    'Unauthorized archive')$$,
  'authenticated tidak boleh memanggil RPC archive detail'
);
reset role;

-- ---------- Period snapshot is the source of truth ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

update public.category
set name = 'Live Category Name',
    weight = 99
where id = '50000000-0000-0000-0000-000000000001';
update public.detail
set name = 'Live Scale Name',
    scale_max = 2,
    is_active = false
where id = '60000000-0000-0000-0000-000000000001';

select public.recalculate_cashier_period_score(
  '40000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001'
);
select pg_temp.assert_true(
  (select category_scores -> '50000000-0000-0000-0000-000000000001' ->> 'name' = 'Security Category'
   and (category_scores -> '50000000-0000-0000-0000-000000000001' ->> 'weight')::numeric = 100
   from public.cashier_period_score
   where cashier_id = '40000000-0000-0000-0000-000000000001'
     and period_id = '70000000-0000-0000-0000-000000000001')
  and (select scale_max = 10
       from public.get_detail_config('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001')),
  'recalculate dan detail config harus membaca snapshot, bukan category/detail live'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
update public.assessment
set scale_value = 1,
    normalized_score = 10,
    assessed_by = '10000000-0000-0000-0000-000000000002'
where id = '80000000-0000-0000-0000-000000000001';

reset role;
set local role service_role;
insert into public.detail (id, category_id, name, type, scale_max)
values ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 'Outside Snapshot', 'scale', 5);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_denied(
  $$insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
    values ('80000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', 1, 20, '10000000-0000-0000-0000-000000000002')$$,
  'assessment detail yang tidak ada di snapshot harus ditolak'
);
reset role;

set local role service_role;
delete from public.detail where id = '60000000-0000-0000-0000-000000000003';
update public.category
set name = 'Security Category',
    weight = 100
where id = '50000000-0000-0000-0000-000000000001';
update public.detail
set name = 'Security Scale',
    scale_max = 10,
    is_active = true
where id = '60000000-0000-0000-0000-000000000001';
reset role;

-- ---------- Atomic invite lifecycle ----------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select (public.consume_invite(
  'security-invite-token-000000000001',
  '10000000-0000-0000-0000-000000000006',
  'security-pending@example.test',
  'Atomic Invite User'
)).id;

select pg_temp.assert_true(
  (select role = 'manager' and is_active = true and full_name = 'Atomic Invite User'
   from public.users
   where id = '10000000-0000-0000-0000-000000000006')
  and (select count(*) = 1
       from public.user_branch
       where user_id = '10000000-0000-0000-0000-000000000006'
         and branch_id = '20000000-0000-0000-0000-000000000001')
  and (select used_at is not null and accepted_user_id = '10000000-0000-0000-0000-000000000006'
       from public.invite
       where id = 'd0000000-0000-0000-0000-000000000001'),
  'consume_invite harus mengaktifkan profile, mengisi branch, dan menandai invite terpakai'
);

select pg_temp.expect_error(
  $$select public.consume_invite('security-invite-token-000000000001', '10000000-0000-0000-0000-000000000007', 'security-expired@example.test', 'Second Attempt')$$,
  'invite tidak boleh dikonsumsi dua kali',
  'sudah digunakan'
);

select public.revoke_invite(
  'd0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001'
);
select pg_temp.assert_true(
  (select revoked_at is not null and revoked_by = '10000000-0000-0000-0000-000000000001'
   from public.invite
   where id = 'd0000000-0000-0000-0000-000000000002'),
  'revoke_invite harus mencatat pencabutan dan actor'
);

select public.regenerate_invite(
  'd0000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'security-regenerated-token-000000000002',
  now() + interval '7 days'
);
select pg_temp.assert_true(
  (select revoked_at is null
       and revoked_by is null
       and token = 'security-regenerated-token-000000000002'
   from public.invite
   where id = 'd0000000-0000-0000-0000-000000000002'),
  'regenerate_invite harus mengganti token dan membuka masa berlaku baru'
);

select pg_temp.expect_error(
  $$select public.consume_invite('security-invite-token-000000000004', '10000000-0000-0000-0000-000000000007', 'security-expired@example.test', 'Expired Attempt')$$,
  'invite kedaluwarsa tidak boleh dikonsumsi',
  'kedaluwarsa'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select pg_temp.expect_denied(
  $$select public.revoke_invite('d0000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001')$$,
  'role authenticated tidak boleh menjalankan revoke_invite'
);
select pg_temp.expect_denied(
  $$select public.consume_invite('security-invite-token-000000000003', '10000000-0000-0000-0000-000000000007', 'security-expired@example.test', 'Unauthorized Attempt')$$,
  'role authenticated tidak boleh menjalankan consume_invite'
);
reset role;

-- ---------- Anonymous access ----------
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
select pg_temp.expect_denied(
  'select id from public.branch',
  'anon tidak boleh membaca branch'
);
select pg_temp.expect_denied(
  'select id from public.leaderboard_entry',
  'anon tidak boleh membaca leaderboard'
);
reset role;

-- ---------- Manager A: own branch only and allowed operations ----------
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select pg_temp.assert_true(
  (select count(*) from public.branch) = 1
  and (select count(*) from public.branch where id = '20000000-0000-0000-0000-000000000001') = 1
  and (select count(*) from public.branch where id = '20000000-0000-0000-0000-000000000002') = 0,
  'manager A harus melihat branch A saja'
);

select pg_temp.assert_true(
  (select count(*) from public.leaderboard_entry) = 1
  and (select count(*) from public.leaderboard_entry where branch_id = '20000000-0000-0000-0000-000000000002') = 0,
  'manager A harus melihat leaderboard branch A saja'
);

select pg_temp.assert_true(
  (select count(*) = 2
   from public.cashier_period_completion
   where period_id = '70000000-0000-0000-0000-000000000001')
  and (select count(*) = 0
       from public.cashier_period_completion
       where period_id = '70000000-0000-0000-0000-000000000001'
         and cashier_id = '40000000-0000-0000-0000-000000000002'),
  'completion hanya boleh terlihat pada cabang manager'
);

select pg_temp.expect_denied(
  $$insert into public.cashier_period_completion (period_id, cashier_id, total_details, assessed_details)
    values ('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 2, 0)$$,
  'authenticated tidak boleh menulis completion langsung'
);

select pg_temp.expect_denied(
  $$update public.users set role = 'admin' where id = auth.uid()$$,
  'manager tidak boleh melakukan self role escalation'
);

insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
values ('80000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 8, 80, '10000000-0000-0000-0000-000000000002');

select pg_temp.assert_true(
  (select status = 'complete'
     and total_details = 2
     and assessed_details = 2
   from public.cashier_period_completion
   where period_id = '70000000-0000-0000-0000-000000000001'
     and cashier_id = '40000000-0000-0000-0000-000000000001'),
  'cashier-period harus complete setelah seluruh snapshot detail dinilai'
);

select pg_temp.expect_denied(
  $$insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
    values ('80000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000001', 8, 80, '10000000-0000-0000-0000-000000000002')$$,
  'manager A tidak boleh menilai cashier branch B'
);

insert into public.deduction_event (id, assessment_id, note, points, created_by)
values ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'Allowed operation', 2, '10000000-0000-0000-0000-000000000002');

select pg_temp.expect_denied(
  $$insert into public.deduction_event (id, assessment_id, note, points, created_by)
    values ('90000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000002', 'Cross branch', 2, '10000000-0000-0000-0000-000000000002')$$,
  'manager A tidak boleh menambah deduction branch B'
);

delete from public.deduction_event where id = '90000000-0000-0000-0000-000000000002';
select pg_temp.assert_true(
  (select count(*) from public.deduction_event where id = '90000000-0000-0000-0000-000000000002') = 0,
  'manager A tidak boleh menghapus deduction branch B'
);

insert into public.mentoring_session (id, outlet_id, conducted_by, visited_date, note_outlet)
values ('a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', current_date, 'Allowed operation');

select pg_temp.expect_denied(
  $$insert into public.mentoring_session (id, outlet_id, conducted_by, visited_date, note_outlet)
    values ('a0000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', current_date, 'Cross branch')$$,
  'manager A tidak boleh membuat sesi branch B'
);

insert into public.mentoring_cashier_note (id, session_id, cashier_id, note)
values ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Allowed operation');

select pg_temp.expect_denied(
  $$insert into public.mentoring_cashier_note (id, session_id, cashier_id, note)
    values ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'Mismatched outlet')$$,
  'catatan mentoring harus cocok dengan outlet session'
);

update public.outlet
set name = 'Security Outlet A Renamed'
where id = '30000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select name from public.outlet where id = '30000000-0000-0000-0000-000000000001') = 'Security Outlet A Renamed',
  'manager dengan permission harus dapat mengubah nama outlet'
);

update public.cashier
set name = 'Security Cashier A Renamed'
where id = '40000000-0000-0000-0000-000000000001';
select pg_temp.assert_true(
  (select name from public.cashier where id = '40000000-0000-0000-0000-000000000001') = 'Security Cashier A Renamed',
  'manager dengan permission harus dapat mengubah nama kasir'
);

select pg_temp.expect_denied(
  $$update public.outlet set is_active = false where id = '30000000-0000-0000-0000-000000000001'$$,
  'manager tidak boleh mengubah kolom status outlet'
);
select pg_temp.expect_denied(
  $$update public.cashier set is_active = false where id = '40000000-0000-0000-0000-000000000001'$$,
  'manager tidak boleh mengubah kolom status kasir'
);

select pg_temp.expect_denied(
  $$insert into public.outlet (id, branch_id, name)
    values ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Illegal Outlet')$$,
  'manager A tidak boleh menambah outlet branch B'
);
select pg_temp.expect_denied(
  $$insert into public.cashier (id, outlet_id, name)
    values ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Illegal Cashier')$$,
  'manager A tidak boleh menambah kasir outlet branch B'
);

select pg_temp.expect_denied(
  $$insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
    values ('80000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 8, 80, '10000000-0000-0000-0000-000000000002')$$,
  'assessment pada periode tertutup harus ditolak'
);

-- ---------- Manager B cannot cross into branch A ----------
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);
select pg_temp.assert_true(
  (select count(*) from public.branch) = 1
  and (select count(*) from public.branch where id = '20000000-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.leaderboard_entry where branch_id = '20000000-0000-0000-0000-000000000001') = 0,
  'manager B harus terisolasi dari branch A'
);
select pg_temp.expect_denied(
  $$insert into public.mentoring_session (id, outlet_id, conducted_by, visited_date, note_outlet)
    values ('a0000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', current_date, 'Cross branch')$$,
  'manager B tidak boleh membuat sesi branch A'
);

-- ---------- Supervisor: read/write permission boundary ----------
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);
select pg_temp.expect_no_rows(
  $$update public.outlet set name = 'Supervisor Must Fail' where id = '30000000-0000-0000-0000-000000000001'$$,
  'supervisor tanpa outlets.update tidak boleh mengubah outlet'
);
select pg_temp.expect_no_rows(
  $$update public.cashier set name = 'Supervisor Must Fail' where id = '40000000-0000-0000-0000-000000000001'$$,
  'supervisor tanpa cashiers.update tidak boleh mengubah kasir'
);

-- ---------- Inactive user: no read or write access ----------
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000005', true);
select pg_temp.assert_true(
  public.is_active_user() = false
  and (select count(*) from public.branch) = 0
  and (select count(*) from public.leaderboard_entry) = 0,
  'akun nonaktif harus tidak memiliki data yang terlihat'
);
select pg_temp.expect_denied(
  $$insert into public.assessment (id, period_id, cashier_id, detail_id, scale_value, normalized_score, assessed_by)
    values ('80000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 8, 80, '10000000-0000-0000-0000-000000000005')$$,
  'akun nonaktif tidak boleh menambah assessment'
);

-- ---------- Admin visibility remains global; sensitive columns remain protected ----------
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true(
  public.is_active_user()
  and (select count(*) from public.leaderboard_entry) = 2,
  'admin aktif harus melihat leaderboard semua cabang'
);
select pg_temp.expect_denied(
  $$update public.cashier set is_active = false where id = '40000000-0000-0000-0000-000000000001'$$,
  'admin melalui authenticated role tetap tidak boleh mengubah kolom status langsung'
);

-- ---------- Period roster and historical placement ----------
reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select pg_temp.assert_true(
  (public.get_period_close_preflight('70000000-0000-0000-0000-000000000001')->>'incompleteCount')::integer > 0
  and (public.get_period_close_preflight('70000000-0000-0000-0000-000000000001')->>'canClose')::boolean = false,
  'preflight harus menandai roster incomplete sebelum close'
);
select pg_temp.expect_error(
  $$select public.close_period(
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001', false, null)$$,
  'close tanpa override tidak boleh melewati incomplete roster',
  'incomplete'
);
select pg_temp.expect_error(
  $$select public.open_period(current_date + 1, current_date)$$,
  'open period harus menolak rentang tanggal terbalik',
  'Rentang tanggal'
);
select pg_temp.expect_error(
  $$select public.open_period(current_date + 29, current_date + 30)$$,
  'open period harus menolak overlap dengan periode open',
  'bertumpang tindih'
);
select pg_temp.expect_error(
  $$select public.close_period(
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002', true, 'Manager override')$$,
  'override incomplete hanya boleh admin',
  'hanya boleh dilakukan admin'
);
select public.close_period(
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', true, 'Kasir cuti dan sudah ditinjau admin'
);
select pg_temp.assert_true(
  (select status = 'closed' from public.period where id = '70000000-0000-0000-0000-000000000001')
  and (select (detail->>'override_incomplete')::boolean = true
       from public.period_log
       where period_id = '70000000-0000-0000-0000-000000000001'
         and action = 'close'
       order by created_at desc limit 1),
  'close override harus menutup periode dan tercatat di period_log'
);
select public.close_period(
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001', true, 'Duplicate close must remain idempotent'
);
select pg_temp.assert_true(
  (select status = 'closed' from public.period where id = '70000000-0000-0000-0000-000000000001'),
  'close kedua harus tetap mempertahankan status closed'
);
select pg_temp.assert_true(
  (select count(*) = 3
   from public.leaderboard_entry
   where period_id = '70000000-0000-0000-0000-000000000001'),
  'close kedua tidak boleh menggandakan leaderboard snapshot'
);
select pg_temp.assert_true(
  (select count(*) = 1
   from public.period_log
   where period_id = '70000000-0000-0000-0000-000000000001' and action = 'close'),
  'close kedua tidak boleh menggandakan period log'
);

select pg_temp.assert_true(
  has_function_privilege('anon', 'public.add_cashier_to_period_roster(uuid,uuid,timestamptz,text,uuid)', 'execute') = false
  and has_function_privilege('authenticated', 'public.add_cashier_to_period_roster(uuid,uuid,timestamptz,text,uuid)', 'execute') = false
  and has_function_privilege('service_role', 'public.add_cashier_to_period_roster(uuid,uuid,timestamptz,text,uuid)', 'execute'),
  'roster add privilege harus service-role-only'
);

insert into public.period (id, label, start_date, end_date, status)
values ('70000000-0000-0000-0000-000000000003', 'SECURITY-ROSTER', current_date - 1, current_date + 30, 'open');
insert into public.category_weight_history (period_id, category_id, weight, category_name)
values ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000001', 100, 'Roster Category');
insert into public.detail_config_history (
  period_id, detail_id, scale_max, deduction_points, category_id, detail_name, detail_type
)
values
  ('70000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000001', 10, null, '50000000-0000-0000-0000-000000000001', 'Roster Scale', 'scale');

select (public.add_cashier_to_period_roster(
  '70000000-0000-0000-0000-000000000003',
  (select id from public.cashier where name = 'Security Atomic Cashier'),
  now(),
  'Kasir masuk di tengah periode',
  '10000000-0000-0000-0000-000000000001'
)).id;

select pg_temp.expect_error(
  $$select public.add_cashier_to_period_roster(
    '70000000-0000-0000-0000-000000000003',
    (select id from public.cashier where name = 'Security Atomic Cashier'),
    now(), 'Duplicate roster', '10000000-0000-0000-0000-000000000001')$$,
  'kasir tidak boleh ditambahkan dua kali ke roster periode',
  'sudah masuk roster'
);

update public.cashier_outlet_history
set started_at = now() - interval '1 minute'
where cashier_id = (select id from public.cashier where name = 'Security Atomic Cashier')
  and ended_at is null;
select (public.transfer_cashier_atomic(
  (select id from public.cashier where name = 'Security Atomic Cashier'),
  '30000000-0000-0000-0000-000000000002',
  now(),
  '10000000-0000-0000-0000-000000000001'
)).id;
select public.close_period(
  '70000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001', true, 'Historical roster security fixture'
);
select pg_temp.assert_true(
  (select outlet_id = '30000000-0000-0000-0000-000000000001'
      and branch_id = '20000000-0000-0000-0000-000000000001'
      and outlet_name = 'Security Outlet A Renamed'
      and rank_global = 1
    from public.leaderboard_entry
   where period_id = '70000000-0000-0000-0000-000000000003'
     and cashier_id = (select id from public.cashier where name = 'Security Atomic Cashier')),
  'leaderboard closed harus memakai placement snapshot, bukan outlet live setelah transfer'
);

insert into public.notification (
  user_id, type, title, body, payload, entity_type, entity_id, period_id, dedupe_key
)
values (
  '10000000-0000-0000-0000-000000000002', 'system', 'Dedupe fixture', 'first', '{}'::jsonb,
  'cashier', '40000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001', 'security:manager-a:cashier-a:period-open'
), (
  '10000000-0000-0000-0000-000000000002', 'system', 'Dedupe fixture', 'duplicate', '{}'::jsonb,
  'cashier', '40000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001', 'security:manager-a:cashier-a:period-open'
)
on conflict (dedupe_key) do nothing;
select pg_temp.assert_true(
  (select count(*) = 1
   from public.notification
   where dedupe_key = 'security:manager-a:cashier-a:period-open'),
  'notification dedupe key harus mencegah duplicate delivery'
);

insert into public.notification (user_id, type, title, body, payload, dedupe_key)
values (
  '10000000-0000-0000-0000-000000000003', 'system', 'Private fixture', 'other user', '{}'::jsonb,
  'security:other-user:private'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true(
  (select count(*) = 1
   from public.notification
   where dedupe_key = 'security:manager-a:cashier-a:period-open'),
  'user harus dapat membaca notification miliknya sendiri'
);
select pg_temp.expect_no_rows(
  $$select id from public.notification where dedupe_key = 'security:other-user:private'$$,
  'user tidak boleh membaca notification milik user lain'
);
select pg_temp.expect_no_rows(
  $$update public.notification set is_read = true where dedupe_key = 'security:other-user:private'$$,
  'user tidak boleh menandai notification milik user lain'
);
update public.notification
set is_read = true
where dedupe_key = 'security:manager-a:cashier-a:period-open';
select pg_temp.assert_true(
  (select is_read from public.notification where dedupe_key = 'security:manager-a:cashier-a:period-open'),
  'user harus dapat menandai notification miliknya sendiri'
);

rollback;

\echo 'SECURITY REGRESSION SUITE PASSED'
