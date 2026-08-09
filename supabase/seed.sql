-- ============================================================
-- seed.sql — Data contoh development & staging (TIDAK untuk produksi)
-- Sesuai development-maintenance-plan.md §6
-- ============================================================

-- Cabang contoh
insert into public.branch (name, code) values
  ('Cabang Jakarta Pusat', 'JKT-01'),
  ('Cabang Bandung', 'BDG-01')
on conflict (code) do nothing;

-- Outlet contoh
insert into public.outlet (branch_id, name)
select b.id, 'Outlet Senen'
from public.branch b
where b.code = 'JKT-01'
on conflict do nothing;

insert into public.outlet (branch_id, name)
select b.id, 'Outlet Thamrin'
from public.branch b
where b.code = 'JKT-01'
on conflict do nothing;

insert into public.outlet (branch_id, name)
select b.id, 'Outlet Dago'
from public.branch b
where b.code = 'BDG-01'
on conflict do nothing;

-- Kasir contoh
insert into public.cashier (name, outlet_id)
select 'Budi Santoso', o.id
from public.outlet o
where o.name = 'Outlet Senen'
on conflict do nothing;

insert into public.cashier (name, outlet_id)
select 'Siti Aminah', o.id
from public.outlet o
where o.name = 'Outlet Senen'
on conflict do nothing;

insert into public.cashier (name, outlet_id)
select 'Dewi Lestari', o.id
from public.outlet o
where o.name = 'Outlet Thamrin'
on conflict do nothing;

-- Riwayat penempatan awal kasir
insert into public.cashier_outlet_history (cashier_id, outlet_id)
select c.id, c.outlet_id
from public.cashier c
on conflict do nothing;

-- Kategori contoh (total 100%)
insert into public.category (name, weight) values
  ('Kebersihan & Kerapian', 25),
  ('Pelayanan', 40),
  ('Akurasi Transaksi', 35)
on conflict do nothing;

-- Detail skala
insert into public.detail (category_id, name, type, scale_max)
select c.id, 'Kerapian Seragam', 'scale', 5
from public.category c where c.name = 'Kebersihan & Kerapian'
on conflict do nothing;

insert into public.detail (category_id, name, type, scale_max)
select c.id, 'Kebersihan Area Kasir', 'scale', 5
from public.category c where c.name = 'Kebersihan & Kerapian'
on conflict do nothing;

insert into public.detail (category_id, name, type, scale_max)
select c.id, 'Keramahan', 'scale', 5
from public.category c where c.name = 'Pelayanan'
on conflict do nothing;

insert into public.detail (category_id, name, type, scale_max)
select c.id, 'Kecepatan Pelayanan', 'scale', 5
from public.category c where c.name = 'Pelayanan'
on conflict do nothing;

-- Detail deduksi
insert into public.detail (category_id, name, type, deduction_points)
select c.id, 'Selisih Kas (Kurang)', 'deduction', 10
from public.category c where c.name = 'Akurasi Transaksi'
on conflict do nothing;

insert into public.detail (category_id, name, type, deduction_points)
select c.id, 'Kesalahan Input Transaksi', 'deduction', 5
from public.category c where c.name = 'Akurasi Transaksi'
on conflict do nothing;

-- Buka periode berjalan (jika belum ada)
insert into public.period (label, start_date, end_date, status)
select
  to_char(current_date, 'YYYY-MM'),
  date_trunc('month', current_date)::date,
  (date_trunc('month', current_date) + interval '1 month - 1 day')::date,
  'open'
where not exists (select 1 from public.period where status = 'open')
on conflict (label) do nothing;

-- Snapshot bobot & config untuk periode aktif (kalau belum ada)
insert into public.category_weight_history (category_id, period_id, weight)
select c.id, p.id, c.weight
from public.category c
join public.period p on p.status = 'open'
on conflict do nothing;

insert into public.detail_config_history (detail_id, period_id, scale_max, deduction_points)
select d.id, p.id, d.scale_max, d.deduction_points
from public.detail d
join public.period p on p.status = 'open'
on conflict do nothing;