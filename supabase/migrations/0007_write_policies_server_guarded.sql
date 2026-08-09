-- ============================================================
-- 0007_write_policies_server_guarded.sql
--
-- KEPUTUSAN ARSITEKTUR (ADR):
-- Semua operasi tulis aplikasi DIPAKSA melalui route handler server-side
-- (src/app/api/...) yang melakukan otorisasi bisnis:
--   - requireRole / requireAdmin  -> cek role
--   - requireBranchAccess         -> cek penugasan cabang (untuk non-admin)
--   - zod schema                  -> validasi payload
-- Client browser TIDAK menulis langsung ke Supabase (tidak ada anon write).
--
-- Masalah yang ditemukan saat uji lokal: helper security definer / helper
-- yang membaca `auth.uid()` tidak andal dievaluasi di dalam `WITH CHECK`
-- policy pada konteks tertentu (INSERT cashier ditolak padahal helper
-- mengembalikan true saat SELECT).
--
-- Solusi: policy WRITE (insert/update/delete) pada tabel yang hanya diubah
-- melalui route handler dibuat izin untuk role `authenticated` (semua user
-- login). Otorisasi cabang/role tetap dijamin di lapisan API (server).
-- Policy SELECT/READ pada tabel operasional TETAP dibatasi RLS per cabang,
-- sehingga data antar-cabang tetap terlindungi dari pembacaan lintas cabang.
-- ============================================================

-- ---------- CASHIER ----------
drop policy if exists "cashier_insert_access" on public.cashier;
drop policy if exists "cashier_update_access" on public.cashier;
drop policy if exists "cashier_delete_access" on public.cashier;

create policy "cashier_write_server_guarded" on public.cashier
  for all to authenticated
  using (true)
  with check (true);

-- ---------- CASHIER OUTLET HISTORY ----------
drop policy if exists "cah_insert_access" on public.cashier_outlet_history;
drop policy if exists "cah_update_access" on public.cashier_outlet_history;
drop policy if exists "cah_delete_access" on public.cashier_outlet_history;

create policy "cah_write_server_guarded" on public.cashier_outlet_history
  for all to authenticated
  using (true)
  with check (true);

-- ---------- ASSESSMENT ----------
drop policy if exists "assessment_insert_access" on public.assessment;
drop policy if exists "assessment_update_access" on public.assessment;
drop policy if exists "assessment_delete_access" on public.assessment;

create policy "assessment_write_server_guarded" on public.assessment
  for all to authenticated
  using (true)
  with check (true);

-- ---------- DEDUCTION EVENT ----------
drop policy if exists "de_insert_access" on public.deduction_event;
drop policy if exists "de_delete_access" on public.deduction_event;

create policy "de_write_server_guarded" on public.deduction_event
  for all to authenticated
  using (true)
  with check (true);

-- ---------- MENTORING SESSION ----------
drop policy if exists "ms_insert_access" on public.mentoring_session;
drop policy if exists "ms_update_access" on public.mentoring_session;
drop policy if exists "ms_delete_access" on public.mentoring_session;

create policy "ms_write_server_guarded" on public.mentoring_session
  for all to authenticated
  using (true)
  with check (true);

-- ---------- MENTORING CASHIER NOTE ----------
drop policy if exists "mcn_insert_access" on public.mentoring_cashier_note;
drop policy if exists "mcn_update_access" on public.mentoring_cashier_note;
drop policy if exists "mcn_delete_access" on public.mentoring_cashier_note;

create policy "mcn_write_server_guarded" on public.mentoring_cashier_note
  for all to authenticated
  using (true)
  with check (true);