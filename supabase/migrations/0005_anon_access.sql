-- ============================================================
-- 0005_anon_access.sql — Akses anon minimal utk alur pra-login
-- Middleware & root page membaca `app_setup` SEBELUM user login
-- (role anon) untuk menentukan redirect /setup vs /login.
-- Tabel ini hanya berisi flag `admin_created`, aman diakses publik.
-- ============================================================

-- Grant SELECT app_setup ke anon
grant select on public.app_setup to anon;

-- Policy RLS utk role anon (baca flag setup saja)
create policy "app_setup_select_anon" on public.app_setup
  for select to anon
  using (true);