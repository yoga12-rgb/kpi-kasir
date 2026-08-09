create table public.role_permission (
  role public.user_role not null,
  permission text not null check (permission in ('assessment', 'leaderboard', 'mentoring', 'cashiers', 'notifications')),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (role, permission)
);

create index role_permission_role_idx on public.role_permission (role);

insert into public.role_permission (role, permission, enabled)
select roles.role, permissions.permission, permissions.permission = any(roles.enabled_permissions)
from (
  values
    ('admin'::public.user_role, array['assessment', 'leaderboard', 'mentoring', 'cashiers', 'notifications']::text[]),
    ('manager'::public.user_role, array['assessment', 'leaderboard', 'mentoring', 'cashiers', 'notifications']::text[]),
    ('supervisor'::public.user_role, array['assessment', 'leaderboard', 'mentoring', 'notifications']::text[])
) as roles(role, enabled_permissions)
cross join (
  values ('assessment'), ('leaderboard'), ('mentoring'), ('cashiers'), ('notifications')
) as permissions(permission)
on conflict (role, permission) do nothing;

alter table public.role_permission enable row level security;

create policy "role_permission_select_auth" on public.role_permission
  for select to authenticated
  using (true);

create policy "role_permission_insert_admin" on public.role_permission
  for insert to authenticated
  with check (public.is_admin());

create policy "role_permission_update_admin" on public.role_permission
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "role_permission_delete_admin" on public.role_permission
  for delete to authenticated
  using (public.is_admin());

create trigger role_permission_updated_at before update on public.role_permission
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.role_permission to authenticated;
