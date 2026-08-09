-- ============================================================
-- 0020_cashier_photo_permissions.sql
-- ============================================================

alter table public.role_permission
  drop constraint if exists role_permission_permission_check;

alter table public.role_permission
  add constraint role_permission_permission_check
  check (
    permission in (
      'assessment',
      'leaderboard',
      'mentoring',
      'branches.view',
      'outlets.view',
      'outlets.create',
      'outlets.update',
      'cashiers.view',
      'cashiers.create',
      'cashier_photos.view',
      'cashier_photos.create',
      'cashier_photos.update',
      'cashier_photos.delete',
      'notifications'
    )
  );

insert into public.role_permission (role, permission, enabled)
values
  ('admin'::public.user_role, 'cashier_photos.view', true),
  ('admin'::public.user_role, 'cashier_photos.create', true),
  ('admin'::public.user_role, 'cashier_photos.update', true),
  ('admin'::public.user_role, 'cashier_photos.delete', true),
  ('manager'::public.user_role, 'cashier_photos.view', true),
  ('manager'::public.user_role, 'cashier_photos.create', false),
  ('manager'::public.user_role, 'cashier_photos.update', false),
  ('manager'::public.user_role, 'cashier_photos.delete', false),
  ('supervisor'::public.user_role, 'cashier_photos.view', true),
  ('supervisor'::public.user_role, 'cashier_photos.create', false),
  ('supervisor'::public.user_role, 'cashier_photos.update', false),
  ('supervisor'::public.user_role, 'cashier_photos.delete', false)
on conflict (role, permission) do nothing;

create or replace function public.storage_can_access_cashier_photo(cashier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.user_has_permission('cashier_photos.view')
    and public.user_can_access_branch(o.branch_id)
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id
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
    where c.id = cashier_id
      and public.user_can_access_branch(o.branch_id)
  );
end;
$$;

grant execute on function public.storage_can_manage_cashier_photo_path(text)
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
    and (
      public.user_has_permission('cashier_photos.create')
      or public.user_has_permission('cashier_photos.update')
    )
    and public.storage_can_manage_cashier_photo_path(name)
  );

create policy "cashier_photos_update_own_branch" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.user_has_permission('cashier_photos.update')
    and public.storage_can_manage_cashier_photo_path(name)
  )
  with check (
    bucket_id = 'cashier-photos'
    and public.user_has_permission('cashier_photos.update')
    and public.storage_can_manage_cashier_photo_path(name)
  );

create policy "cashier_photos_delete_own_branch" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'cashier-photos'
    and public.user_has_permission('cashier_photos.delete')
    and public.storage_can_manage_cashier_photo_path(name)
  );
