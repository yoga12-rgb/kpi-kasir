-- ============================================================
-- 0008_cashier_avatar.sql — Kolom foto profil kasir
-- Menyimpan path objek di Supabase Storage bucket `cashier-photos`
-- (misal: cashier/<cashierId>/avatar.<ext>).
-- ============================================================

alter table public.cashier
  add column avatar_url text;