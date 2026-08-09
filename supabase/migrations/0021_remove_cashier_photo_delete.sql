-- ============================================================
-- 0021_remove_cashier_photo_delete.sql
-- ============================================================

-- Foto kasir hanya dapat diunggah atau diganti. Penghapusan melalui
-- endpoint aplikasi dan akses langsung ke storage tidak lagi tersedia.
delete from public.role_permission
where permission = 'cashier_photos.delete';

drop policy if exists "cashier_photos_delete_own_branch" on storage.objects;

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
      'notifications'
    )
  );
