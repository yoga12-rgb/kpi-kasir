-- ============================================================
-- 0034_atomic_cashier_create.sql
--
-- M3.1: cashier dan initial placement harus dibuat atomik.
-- ============================================================

do $$
begin
  if exists (
    select 1
    from public.cashier_outlet_history
    where ended_at is null
    group by cashier_id
    having count(*) > 1
  ) then
    raise exception 'Tidak dapat membuat constraint: ditemukan lebih dari satu history aktif per kasir';
  end if;
end;
$$;

create unique index cashier_one_active_history_idx
  on public.cashier_outlet_history (cashier_id)
  where ended_at is null;

create or replace function public.create_cashier_with_history(
  p_name text,
  p_outlet_id uuid,
  p_employment_start_date date,
  p_actor_id uuid
)
returns public.cashier
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_cashier public.cashier;
  v_outlet public.outlet;
  v_branch_active boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_actor_id is null
    or char_length(btrim(coalesce(p_name, ''))) < 2
    or char_length(btrim(coalesce(p_name, ''))) > 100
    or p_outlet_id is null
    or p_employment_start_date is null
    or p_employment_start_date > current_date then
    raise exception 'Data kasir tidak valid';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id
  for share;

  if v_actor.id is null or not v_actor.is_active then
    raise exception 'Actor tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.role_permission
      where role = v_actor.role
        and permission = 'cashiers.create'
        and enabled = true
    ) then
    raise exception 'Actor tidak memiliki permission membuat kasir';
  end if;

  select o.*
  into v_outlet
  from public.outlet o
  join public.branch b on b.id = o.branch_id
  where o.id = p_outlet_id
  for share of o;

  select is_active into v_branch_active
  from public.branch
  where id = v_outlet.branch_id
  for share;

  if v_outlet.id is null or not v_outlet.is_active or not v_branch_active then
    raise exception 'Outlet atau cabang tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1
      from public.user_branch
      where user_id = v_actor.id
        and branch_id = v_outlet.branch_id
    ) then
    raise exception 'Actor tidak memiliki akses ke cabang outlet';
  end if;

  insert into public.cashier (name, outlet_id, employment_start_date)
  values (btrim(p_name), p_outlet_id, p_employment_start_date)
  returning * into v_cashier;

  insert into public.cashier_outlet_history (cashier_id, outlet_id)
  values (v_cashier.id, p_outlet_id);

  return v_cashier;
end;
$$;

revoke all on function public.create_cashier_with_history(text, uuid, date, uuid)
  from public, anon, authenticated;
grant execute on function public.create_cashier_with_history(text, uuid, date, uuid) to service_role;
