-- Diagnosis & verifikasi RLS cashier (setelah migrasi 0006 + 0007)
\set QUIET on

-- Setup profil & penugasan test (UUID diambil pasca `db reset`)
update public.users set role = 'admin' where id = '984cbd7c-c97d-4efb-b633-78aa24d82f68';
update public.users set role = 'supervisor' where id = '717d749f-186a-4e70-8130-04d65faa2d96';
insert into public.user_branch (user_id, branch_id)
values ('717d749f-186a-4e70-8130-04d65faa2d96', 'c87edb15-1080-48d0-8503-8a935e898969')
on conflict do nothing;
delete from public.cashier where name like 'Kasir Test%';

-- Test sebagai ADMIN
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"984cbd7c-c97d-4efb-b633-78aa24d82f68","role":"authenticated"}', false);
select
  (select role from public.users where id = '984cbd7c-c97d-4efb-b633-78aa24d82f68') as user_role;

insert into public.cashier (name, outlet_id)
values ('Kasir Test Admin OK', 'f7630461-c998-4100-9ef2-a6359fc20e2d')
returning name;

-- Test sebagai SUPERVISOR (y@gmail.com, cabang Bandung)
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"717d749f-186a-4e70-8130-04d65faa2d96","role":"authenticated"}', false);
select
  (select role from public.users where id = '717d749f-186a-4e70-8130-04d65faa2d96') as user_role;

insert into public.cashier (name, outlet_id)
values ('Kasir Test Supervisor OK', 'f7630461-c998-4100-9ef2-a6359fc20e2d')
returning name;

-- Cek supervisor TIDAK bisa INSERT ke outlet di luar cabangnya: Outlet Senen (Jakarta)
insert into public.cashier (name, outlet_id)
values ('Kasir Test Lintas Cabang HARUS GAGAL', '0fd2bbd8-4487-4563-a2d6-2966a1207e3f')
returning name;

reset role;

-- Bersihkan data test yang berhasil
delete from public.cashier where name like 'Kasir Test%';