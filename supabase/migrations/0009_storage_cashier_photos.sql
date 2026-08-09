-- ============================================================
-- 0009_storage_cashier_photos.sql — Bucket & policy foto kasir
--
-- Bucket: `cashier-photos` (PRIVATE)
-- Path objek: cashier/<cashierId>/avatar.<ext>
-- Privasi bucket sepenuhnya dikontrol via policy storage pada
-- tabel storage.objects (tidak ada policy anon — hanya authenticated
-- yang berhak, dan hanya untuk cabang yang diakses).
-- Akses:
--   SELECT : hanya user login yang punya akses cabang kasir tsb
--            (via helper public.user_can_access_branch) ATAU admin.
--   INSERT/UPDATE/DELETE : user login yang punya akses cabang kasir tsb
--            ATAU admin. (Operasi tulis file tetap dipaksa lewat route
--            handler server yang juga cek requireUser + branch access.)
-- ============================================================

insert into storage.buckets (id, name)
values ('cashier-photos', 'cashier-photos')
on conflict (id) do nothing;

-- ---------- Helper: akses storage objek foto kasir ----------
-- Nama objek: cashier/<cashierId>/avatar.<ext>
-- Ambil cashierId dari path objek lalu cek akses cabang.
create or replace function public.storage_can_access_cashier_photo(cashier_id uuid)
returns boolean
language sql
stable
as $$
  select public.user_can_access_branch(o.branch_id)
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id
  where c.id = $1
$$;

grant execute on function public.storage_can_access_cashier_photo(uuid) to authenticated, service_role;

-- ---------- Policy SELECT ----------
create policy "cashier_photos_select_own_branch" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cashier-photos'
    and (
      (storage.foldername(name))[1] is null
      or exists (
        select 1
        from public.cashier c
        where c.id = (storage.foldername(name))[1]::uuid
          and public.storage_can_access_cashier_photo(c.id)
      )
    )
  );

-- ---------- Policy INSERT ----------
create policy "cashier_photos_insert_own_branch" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cashier-photos'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.cashier c
      where c.id = (storage.foldername(name))[1]::uuid
        and public.storage_can_access_cashier_photo(c.id)
    )
  );

-- ---------- Policy UPDATE ----------
create policy "cashier_photos_update_own_branch" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cashier-photos'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.cashier c
      where c.id = (storage.foldername(name))[1]::uuid
        and public.storage_can_access_cashier_photo(c.id)
    )
  )
  with check (
    bucket_id = 'cashier-photos'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.cashier c
      where c.id = (storage.foldername(name))[1]::uuid
        and public.storage_can_access_cashier_photo(c.id)
    )
  );

-- ---------- Policy DELETE ----------
create policy "cashier_photos_delete_own_branch" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cashier-photos'
    and (storage.foldername(name))[1] is not null
    and exists (
      select 1
      from public.cashier c
      where c.id = (storage.foldername(name))[1]::uuid
        and public.storage_can_access_cashier_photo(c.id)
    )
  );