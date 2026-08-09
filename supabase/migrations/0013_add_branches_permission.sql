alter table public.role_permission
  drop constraint role_permission_permission_check;

alter table public.role_permission
  add constraint role_permission_permission_check
  check (permission in ('assessment', 'leaderboard', 'mentoring', 'cashiers', 'branches', 'notifications'));

insert into public.role_permission (role, permission, enabled)
values
  ('admin', 'branches', true),
  ('manager', 'branches', true),
  ('supervisor', 'branches', false)
on conflict (role, permission) do nothing;
