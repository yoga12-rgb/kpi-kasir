-- ============================================================
-- 0004_grants.sql — Grant akses fungsi RPC & tabel
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

-- Tabel: baca untuk authenticated (RLS tetap aktif)
grant select on public.app_setup to authenticated;
grant select, update on public.users to authenticated;
grant select, insert, update, delete on public.branch to authenticated;
grant select, insert, update, delete on public.outlet to authenticated;
grant select, insert, update, delete on public.cashier to authenticated;
grant select, insert, update, delete on public.cashier_outlet_history to authenticated;
grant select, insert, update, delete on public.user_branch to authenticated;
grant select, insert, update, delete on public.category to authenticated;
grant select on public.category_weight_history to authenticated;
grant select, insert, update, delete on public.detail to authenticated;
grant select on public.detail_config_history to authenticated;
grant select, insert, update on public.period to authenticated;
grant select, insert, update, delete on public.assessment to authenticated;
grant select, insert, delete on public.deduction_event to authenticated;
grant select on public.cashier_period_score to authenticated;
grant select on public.leaderboard_entry to authenticated;
grant select on public.cashier_cumulative_score to authenticated;
grant select, insert, update, delete on public.mentoring_session to authenticated;
grant select, insert, update, delete on public.mentoring_cashier_note to authenticated;
grant select, insert, update on public.invite to authenticated;
grant select, update on public.notification to authenticated;
grant select on public.period_log to authenticated;

-- service_role: akses penuh semua tabel (untuk operasi server)
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- Fungsi RPC yang dipanggil aplikasi (server via service_role, dan beberapa via authenticated)
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.user_has_branch_access(uuid) to authenticated, service_role;
grant execute on function public.user_has_cashier_access(uuid) to authenticated, service_role;
grant execute on function public.user_has_outlet_access(uuid) to authenticated, service_role;
grant execute on function public.compute_normalized_score(numeric, numeric) to authenticated, service_role;
grant execute on function public.get_category_weight(uuid, uuid) to authenticated, service_role;
grant execute on function public.get_detail_config(uuid, uuid) to authenticated, service_role;
grant execute on function public.recalculate_cashier_period_score(uuid, uuid) to authenticated, service_role;
grant execute on function public.close_period(uuid, uuid) to authenticated, service_role;
grant execute on function public.open_period(date, date, uuid) to authenticated, service_role;