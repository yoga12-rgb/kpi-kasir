-- ============================================================
-- 0010_fix_storage_cashier_photo_policy.sql
--
-- Path foto kasir: cashier/<cashierId>/avatar.<ext>
-- Migration 0009 membaca folder pertama sebagai UUID, padahal
-- folder pertama adalah literal "cashier".
-- ============================================================

create or replace function public.storage_can_access_cashier_photo_path(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  folders text[];
  cashier_id uuid;
begin
  folders := storage.foldername(object_name);

  if coalesce(array_length(folders, 1), 0) < 2 or folders[1] <> 'cashier' then
    return false;
  end if;

  begin
    cashier_id := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return public.storage_can_access_cashier_photo(cashier_id);
end;
$$;

grant execute on function public.storage_can_access_cashier_photo_path(text)
  to authenticated, service_role;

drop policy if exists "cashier_photos_select_own_branch" on storage.objects;
drop policy if exists "cashier_photos_insert_own_branch" on storage.objects;
drop policy if exists "cashier_photos_update_own_branch" on storage.objects;
drop policy if exists "cashier_photos_delete_own_branch" on storage.objects;

create policy "cashier_photos_select_own_branch" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.storage_can_access_cashier_photo_path(name)
  );

create policy "cashier_photos_insert_own_branch" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'cashier-photos'
    and public.storage_can_access_cashier_photo_path(name)
  );

create policy "cashier_photos_update_own_branch" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.storage_can_access_cashier_photo_path(name)
  )
  with check (
    bucket_id = 'cashier-photos'
    and public.storage_can_access_cashier_photo_path(name)
  );

create policy "cashier_photos_delete_own_branch" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.storage_can_access_cashier_photo_path(name)
  );
