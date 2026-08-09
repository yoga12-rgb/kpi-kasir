-- 0053_list_pagination_indexes.sql
-- M6.3: support bounded list ordering and scope filters.

create index if not exists cashier_active_name_id_idx
  on public.cashier (is_active, name, id);

create index if not exists cashier_outlet_active_name_id_idx
  on public.cashier (outlet_id, is_active, name, id);

create index if not exists outlet_branch_name_id_idx
  on public.outlet (branch_id, name, id);

create index if not exists branch_name_id_idx
  on public.branch (name, id);

create index if not exists users_created_id_idx
  on public.users (created_at desc, id desc);

create index if not exists invite_created_id_idx
  on public.invite (created_at desc, id desc);
