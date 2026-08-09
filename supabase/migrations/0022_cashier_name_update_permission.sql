-- ============================================================
-- 0022_cashier_name_update_permission.sql
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
      'cashiers.update',
      'cashier_photos.view',
      'cashier_photos.create',
      'cashier_photos.update',
      'notifications'
    )
  );

insert into public.role_permission (role, permission, enabled)
values
  ('admin'::public.user_role, 'cashiers.update', true),
  ('manager'::public.user_role, 'cashiers.update', false),
  ('supervisor'::public.user_role, 'cashiers.update', false)
on conflict (role, permission) do nothing;
