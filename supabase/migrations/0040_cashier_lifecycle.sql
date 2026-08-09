-- ============================================================
-- 0040_cashier_lifecycle.sql
--
-- M3.5: lifecycle kasir dan guard deaktivasi parent.
-- Status kasir hanya boleh berubah melalui RPC service-role setelah
-- route melakukan guard admin. Placement aktif selalu konsisten dengan
-- status kasir: nonaktif tidak memiliki placement aktif, reaktivasi
-- membuat placement baru pada outlet terakhir yang masih aktif.
-- ============================================================

create table if not exists public.cashier_status_history (
  id uuid primary key default gen_random_uuid(),
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  is_active boolean not null,
  reason text not null,
  effective_at timestamptz not null,
  changed_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cashier_status_history_reason_check
    check (char_length(btrim(reason)) between 3 and 500)
);

create index if not exists cashier_status_history_cashier_idx
  on public.cashier_status_history (cashier_id, effective_at desc);

alter table public.cashier_status_history enable row level security;
grant select on public.cashier_status_history to authenticated;
grant all on public.cashier_status_history to service_role;

drop policy if exists "cashier_status_history_select_admin" on public.cashier_status_history;
create policy "cashier_status_history_select_admin" on public.cashier_status_history
  for select to authenticated
  using (public.is_admin());

-- Normalize legacy inactive cashiers that still have an open placement.
update public.cashier_outlet_history h
set ended_at = greatest(c.updated_at, h.started_at)
from public.cashier c
where c.id = h.cashier_id
  and c.is_active = false
  and h.ended_at is null;

insert into public.cashier_status_history (
  cashier_id,
  is_active,
  reason,
  effective_at,
  changed_by
)
select
  c.id,
  c.is_active,
  'Status awal sebelum pencatatan lifecycle',
  c.created_at,
  null
from public.cashier c
where not exists (
  select 1
  from public.cashier_status_history h
  where h.cashier_id = c.id
);

create or replace function public.user_can_view_cashier(cashier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_user()
    and exists (
      select 1
      from public.cashier c
      join public.outlet o on o.id = c.outlet_id
      join public.branch b on b.id = o.branch_id
      where c.id = $1
        and (
          public.is_admin()
          or (
            c.is_active
            and o.is_active
            and b.is_active
            and public.user_has_branch_access(b.id)
          )
        )
    )
$$;

grant execute on function public.user_can_view_cashier(uuid) to authenticated, service_role;

drop policy if exists "cashier_select_access" on public.cashier;
create policy "cashier_select_access" on public.cashier
  for select to authenticated
  using (
    public.user_has_permission('cashiers.view')
    and public.user_can_view_cashier(id)
  );

drop policy if exists "cah_select_access" on public.cashier_outlet_history;
create policy "cah_select_access" on public.cashier_outlet_history
  for select to authenticated
  using (
    public.user_has_permission('cashiers.view')
    and public.user_can_view_cashier(cashier_id)
  );

create or replace function public.set_cashier_status_atomic(
  p_cashier_id uuid,
  p_is_active boolean,
  p_reason text,
  p_effective_at timestamptz default null,
  p_actor_id uuid default null
)
returns public.cashier
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_before public.cashier;
  v_after public.cashier;
  v_active_history public.cashier_outlet_history;
  v_last_activity timestamptz;
  v_effective_at timestamptz := coalesce(p_effective_at, clock_timestamp());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_outlet_active boolean;
  v_branch_active boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Alasan status wajib 3 sampai 500 karakter';
  end if;

  if v_effective_at > clock_timestamp() + interval '1 minute' then
    raise exception 'Tanggal efektif tidak boleh lebih dari satu menit di masa depan';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id
    and role = 'admin'
    and is_active = true
  for update;

  if v_actor.id is null then
    raise exception 'Actor admin tidak valid';
  end if;

  select * into v_before
  from public.cashier
  where id = p_cashier_id
  for update;

  if v_before.id is null then
    raise exception 'Kasir tidak ditemukan';
  end if;

  if v_before.is_active = p_is_active then
    raise exception 'Status kasir sudah sesuai';
  end if;

  select max(coalesce(ended_at, started_at)) into v_last_activity
  from public.cashier_outlet_history
  where cashier_id = v_before.id;

  if v_last_activity is not null and v_effective_at <= v_last_activity then
    raise exception 'Tanggal efektif harus setelah aktivitas penempatan terakhir';
  end if;

  if p_is_active = false then
    select * into v_active_history
    from public.cashier_outlet_history
    where cashier_id = v_before.id
      and ended_at is null
    for update;

    if v_active_history.id is null then
      raise exception 'Kasir aktif tidak memiliki penempatan aktif';
    end if;

    if v_effective_at <= v_active_history.started_at then
      raise exception 'Tanggal efektif harus setelah penempatan aktif dimulai';
    end if;

    update public.cashier_outlet_history
    set ended_at = v_effective_at
    where id = v_active_history.id;
  else
    select o.is_active, b.is_active
      into v_outlet_active, v_branch_active
    from public.outlet o
    join public.branch b on b.id = o.branch_id
    where o.id = v_before.outlet_id;

    if not coalesce(v_outlet_active, false) or not coalesce(v_branch_active, false) then
      raise exception 'Kasir tidak dapat diaktifkan pada outlet atau cabang nonaktif';
    end if;

    insert into public.cashier_outlet_history (cashier_id, outlet_id, started_at)
    values (v_before.id, v_before.outlet_id, v_effective_at);
  end if;

  update public.cashier
  set is_active = p_is_active
  where id = v_before.id
  returning * into v_after;

  insert into public.cashier_status_history (
    cashier_id,
    is_active,
    reason,
    effective_at,
    changed_by
  )
  values (v_after.id, v_after.is_active, v_reason, v_effective_at, p_actor_id);

  insert into public.audit_log (
    actor_id,
    action,
    entity_type,
    entity_id,
    before_data,
    after_data
  )
  values (
    p_actor_id,
    'cashier.status_changed',
    'cashier',
    v_after.id,
    jsonb_build_object('is_active', v_before.is_active),
    jsonb_build_object(
      'is_active', v_after.is_active,
      'reason', v_reason,
      'effective_at', v_effective_at
    )
  );

  return v_after;
end;
$$;

revoke all on function public.set_cashier_status_atomic(uuid, boolean, text, timestamptz, uuid)
  from public, anon, authenticated;
grant execute on function public.set_cashier_status_atomic(uuid, boolean, text, timestamptz, uuid)
  to service_role;

create or replace function public.set_outlet_status_guarded(
  p_outlet_id uuid,
  p_is_active boolean,
  p_reason text,
  p_actor_id uuid
)
returns public.outlet
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_before public.outlet;
  v_after public.outlet;
  v_branch_active boolean;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Alasan status wajib 3 sampai 500 karakter';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then raise exception 'Actor admin tidak valid'; end if;

  select * into v_before from public.outlet where id = p_outlet_id for update;
  if v_before.id is null then raise exception 'Outlet tidak ditemukan'; end if;
  if v_before.is_active = p_is_active then raise exception 'Status outlet sudah sesuai'; end if;

  if p_is_active = false and exists (
    select 1 from public.cashier c where c.outlet_id = v_before.id and c.is_active = true
  ) then
    raise exception 'Outlet tidak dapat dinonaktifkan karena masih memiliki kasir aktif';
  end if;

  if p_is_active = true then
    select b.is_active into v_branch_active
    from public.branch b where b.id = v_before.branch_id;
    if not coalesce(v_branch_active, false) then
      raise exception 'Outlet tidak dapat diaktifkan pada cabang nonaktif';
    end if;
  end if;

  update public.outlet set is_active = p_is_active where id = v_before.id returning * into v_after;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id,
    'outlet.status_changed',
    'outlet',
    v_after.id,
    jsonb_build_object('is_active', v_before.is_active),
    jsonb_build_object('is_active', v_after.is_active, 'reason', v_reason)
  );
  return v_after;
end;
$$;

revoke all on function public.set_outlet_status_guarded(uuid, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_outlet_status_guarded(uuid, boolean, text, uuid)
  to service_role;

create or replace function public.set_branch_status_guarded(
  p_branch_id uuid,
  p_is_active boolean,
  p_reason text,
  p_actor_id uuid
)
returns public.branch
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_before public.branch;
  v_after public.branch;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Alasan status wajib 3 sampai 500 karakter';
  end if;

  select * into v_actor
  from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then raise exception 'Actor admin tidak valid'; end if;

  select * into v_before from public.branch where id = p_branch_id for update;
  if v_before.id is null then raise exception 'Cabang tidak ditemukan'; end if;
  if v_before.is_active = p_is_active then raise exception 'Status cabang sudah sesuai'; end if;

  if p_is_active = false and exists (
    select 1
    from public.cashier c
    join public.outlet o on o.id = c.outlet_id
    where o.branch_id = v_before.id
      and o.is_active = true
      and c.is_active = true
  ) then
    raise exception 'Cabang tidak dapat dinonaktifkan karena masih memiliki kasir aktif';
  end if;

  update public.branch set is_active = p_is_active where id = v_before.id returning * into v_after;

  insert into public.audit_log (actor_id, action, entity_type, entity_id, before_data, after_data)
  values (
    p_actor_id,
    'branch.status_changed',
    'branch',
    v_after.id,
    jsonb_build_object('is_active', v_before.is_active),
    jsonb_build_object('is_active', v_after.is_active, 'reason', v_reason)
  );
  return v_after;
end;
$$;

revoke all on function public.set_branch_status_guarded(uuid, boolean, text, uuid)
  from public, anon, authenticated;
grant execute on function public.set_branch_status_guarded(uuid, boolean, text, uuid)
  to service_role;

-- Branch status is a sensitive mutation, just like cashier/outlet status.
revoke update on public.branch from authenticated;
grant update (name, code) on public.branch to authenticated;
