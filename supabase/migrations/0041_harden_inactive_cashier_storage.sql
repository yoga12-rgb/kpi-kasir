-- ============================================================
-- 0041_harden_inactive_cashier_storage.sql
--
-- M3.5 follow-up: admin dapat melihat foto/profile historis kasir
-- nonaktif, user cabang hanya dapat melihat/mengelola foto kasir aktif
-- pada outlet dan cabang aktif.
-- ============================================================

create or replace function public.storage_can_access_cashier_photo(cashier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_has_permission('cashier_photos.view')
    and (
      public.is_admin()
      or (
        c.is_active
        and o.is_active
        and b.is_active
        and public.user_can_access_branch(b.id)
      )
    )
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id
  join public.branch b on b.id = o.branch_id
  where c.id = $1
$$;

create or replace function public.storage_can_manage_cashier_photo_path(object_name text)
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

  return exists (
    select 1
    from public.cashier c
    join public.outlet o on o.id = c.outlet_id
    join public.branch b on b.id = o.branch_id
    where c.id = cashier_id
      and (
        public.is_admin()
        or (c.is_active and o.is_active and b.is_active and public.user_can_access_branch(b.id))
      )
  );
end;
$$;
