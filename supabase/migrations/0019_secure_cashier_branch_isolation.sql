-- ============================================================
-- 0019_secure_cashier_branch_isolation.sql
--
-- Migration 0007 membuat policy FOR ALL USING (true) untuk kebutuhan
-- route server. Policy tersebut juga berlaku untuk SELECT dan membuka
-- data kasir lintas cabang. Policy baca/tulis yang lebih spesifik sudah
-- tersedia pada migration 0014 dan 0017, sehingga policy permisif ini
-- harus dihapus.
-- ============================================================

drop policy if exists "cashier_write_server_guarded" on public.cashier;
drop policy if exists "cah_write_server_guarded" on public.cashier_outlet_history;
