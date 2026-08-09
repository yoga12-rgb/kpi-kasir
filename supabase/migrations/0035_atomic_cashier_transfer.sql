-- ============================================================
-- 0035_atomic_cashier_transfer.sql
--
-- M3.2: transfer cashier dan placement history atomik.
-- ============================================================

create or replace function public.transfer_cashier_atomic(
  p_cashier_id uuid,
  p_target_outlet_id uuid,
  p_effective_at timestamptz,
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
  v_target public.outlet;
  v_target_branch_active boolean;
  v_active_history public.cashier_outlet_history;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_cashier_id is null or p_target_outlet_id is null or p_actor_id is null
    or p_effective_at is null or p_effective_at > now() then
    raise exception 'Data transfer tidak valid';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id
  for share;

  if v_actor.id is null or not v_actor.is_active or v_actor.role <> 'admin' then
    raise exception 'Actor transfer tidak valid';
  end if;

  select * into v_cashier
  from public.cashier
  where id = p_cashier_id
  for update;

  if v_cashier.id is null or not v_cashier.is_active then
    raise exception 'Kasir tidak aktif atau tidak ditemukan';
  end if;

  if v_cashier.outlet_id = p_target_outlet_id then
    raise exception 'Outlet tujuan sama dengan outlet saat ini';
  end if;

  select o.* into v_target
  from public.outlet o
  join public.branch b on b.id = o.branch_id
  where o.id = p_target_outlet_id
    and o.is_active = true
    and b.is_active = true
  for share of o;

  if v_target.id is null then
    raise exception 'Outlet tujuan tidak aktif atau tidak ditemukan';
  end if;

  select * into v_active_history
  from public.cashier_outlet_history
  where cashier_id = v_cashier.id
    and ended_at is null
  order by started_at desc
  limit 1
  for update;

  if v_active_history.id is null then
    raise exception 'History placement aktif tidak ditemukan';
  end if;

  if p_effective_at <= v_active_history.started_at then
    raise exception 'Tanggal efektif harus setelah awal placement aktif';
  end if;

  update public.cashier_outlet_history
  set ended_at = p_effective_at
  where id = v_active_history.id;

  update public.cashier
  set outlet_id = p_target_outlet_id
  where id = v_cashier.id
  returning * into v_cashier;

  insert into public.cashier_outlet_history (cashier_id, outlet_id, started_at)
  values (v_cashier.id, p_target_outlet_id, p_effective_at);

  return v_cashier;
end;
$$;

revoke all on function public.transfer_cashier_atomic(uuid, uuid, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.transfer_cashier_atomic(uuid, uuid, timestamptz, uuid) to service_role;
