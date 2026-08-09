-- ============================================================
-- 0046_period_roster_historical_placement.sql
--
-- M4.4: period roster menjadi source of truth untuk placement historis.
-- ============================================================

alter table public.leaderboard_entry
  add column if not exists cashier_name text,
  add column if not exists outlet_name text,
  add column if not exists branch_name text,
  add column if not exists avatar_path text;

create table if not exists public.cashier_period_roster (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.period (id) on delete cascade,
  cashier_id uuid not null references public.cashier (id),
  outlet_id uuid not null references public.outlet (id),
  branch_id uuid not null references public.branch (id),
  cashier_name text not null,
  outlet_name text not null,
  branch_name text not null,
  avatar_path text,
  eligible_from date not null,
  entry_reason text not null default 'period_open',
  created_at timestamptz not null default now(),
  unique (period_id, cashier_id),
  check (char_length(btrim(cashier_name)) between 1 and 100),
  check (char_length(btrim(outlet_name)) between 1 and 150),
  check (char_length(btrim(branch_name)) between 1 and 150),
  check (char_length(btrim(entry_reason)) between 1 and 200)
);

create index if not exists cashier_period_roster_period_branch_idx
  on public.cashier_period_roster (period_id, branch_id);

create index if not exists cashier_period_roster_cashier_idx
  on public.cashier_period_roster (cashier_id, period_id);

alter table public.cashier_period_roster enable row level security;

create policy "cpr_select_access" on public.cashier_period_roster
  for select to authenticated
  using (
    public.user_has_permission('leaderboard')
    and public.user_has_branch_access(branch_id)
  );

create policy "active_user_guard" on public.cashier_period_roster
  as restrictive for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

grant select on public.cashier_period_roster to authenticated;
grant all on public.cashier_period_roster to service_role;

-- Legacy leaderboard rows get display metadata from the current relation once.
update public.leaderboard_entry le
set cashier_name = coalesce(le.cashier_name, c.name),
    outlet_name = coalesce(le.outlet_name, o.name),
    branch_name = coalesce(le.branch_name, b.name),
    avatar_path = coalesce(le.avatar_path, c.avatar_url)
from public.cashier c
join public.outlet o on true
join public.branch b on true
where c.id = le.cashier_id
  and o.id = le.outlet_id
  and b.id = le.branch_id;

-- Existing open periods created before this migration receive a one-time roster.
insert into public.cashier_period_roster (
  period_id, cashier_id, outlet_id, branch_id,
  cashier_name, outlet_name, branch_name, avatar_path,
  eligible_from, entry_reason
)
select
  p.id, c.id, c.outlet_id, o.branch_id,
  c.name, o.name, b.name, c.avatar_url,
  greatest(p.start_date, coalesce(c.employment_start_date, p.start_date)),
  'legacy_period_backfill'
from public.period p
join public.cashier c on c.is_active = true
join public.outlet o on o.id = c.outlet_id and o.is_active = true
join public.branch b on b.id = o.branch_id and b.is_active = true
where p.status = 'open'
on conflict (period_id, cashier_id) do nothing;

create or replace function public.add_cashier_to_period_roster(
  p_period_id uuid,
  p_cashier_id uuid,
  p_effective_at timestamptz default now(),
  p_reason text default 'cashier_joined_mid_period',
  p_performed_by uuid default null
)
returns public.cashier_period_roster
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_period public.period;
  v_cashier public.cashier;
  v_outlet public.outlet;
  v_branch public.branch;
  v_roster public.cashier_period_roster;
  v_effective_date date;
  v_total_details integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  if p_performed_by is null or p_cashier_id is null or p_period_id is null
    or p_effective_at is null
    or char_length(btrim(coalesce(p_reason, ''))) < 3
    or char_length(btrim(coalesce(p_reason, ''))) > 200 then
    raise exception 'Data roster tidak valid';
  end if;

  select * into v_actor from public.users where id = p_performed_by for share;
  if v_actor.id is null or not v_actor.is_active or v_actor.role <> 'admin' then
    raise exception 'Actor roster harus admin aktif';
  end if;

  select * into v_period from public.period where id = p_period_id for update;
  if v_period.id is null or v_period.status <> 'open' then
    raise exception 'Periode roster tidak ditemukan atau sudah ditutup';
  end if;

  v_effective_date := p_effective_at::date;
  if v_effective_date < v_period.start_date or v_effective_date > v_period.end_date then
    raise exception 'Tanggal masuk roster berada di luar periode';
  end if;

  select c.* into v_cashier
  from public.cashier c
  where c.id = p_cashier_id
  for share;
  if v_cashier.id is null or not v_cashier.is_active then
    raise exception 'Kasir roster tidak aktif atau tidak ditemukan';
  end if;

  select o.* into v_outlet
  from public.outlet o
  where o.id = v_cashier.outlet_id
  for share;
  select b.* into v_branch from public.branch b where b.id = v_outlet.branch_id for share;
  if v_outlet.id is null or not v_outlet.is_active or v_branch.id is null or not v_branch.is_active then
    raise exception 'Outlet atau cabang roster tidak aktif';
  end if;

  if exists (
    select 1 from public.cashier_period_roster
    where period_id = p_period_id and cashier_id = p_cashier_id
  ) then
    raise exception 'Kasir sudah masuk roster periode';
  end if;

  insert into public.cashier_period_roster (
    period_id, cashier_id, outlet_id, branch_id,
    cashier_name, outlet_name, branch_name, avatar_path,
    eligible_from, entry_reason
  )
  values (
    p_period_id, p_cashier_id, v_cashier.outlet_id, v_outlet.branch_id,
    btrim(v_cashier.name), btrim(v_outlet.name), btrim(v_branch.name), v_cashier.avatar_url,
    v_effective_date, btrim(p_reason)
  )
  returning * into v_roster;

  select count(*)::integer into v_total_details
  from public.detail_config_history where period_id = p_period_id;

  insert into public.cashier_period_completion (
    period_id, cashier_id, status, total_details, assessed_details
  )
  values (p_period_id, p_cashier_id, 'not_started', v_total_details, 0)
  on conflict (period_id, cashier_id) do nothing;

  insert into public.period_log (action, period_id, performed_by, detail)
  values (
    'roster_add', p_period_id, p_performed_by,
    jsonb_build_object(
      'cashier_id', p_cashier_id,
      'outlet_id', v_cashier.outlet_id,
      'eligible_from', v_effective_date,
      'reason', btrim(p_reason)
    )
  );

  return v_roster;
end;
$$;

revoke all on function public.add_cashier_to_period_roster(uuid, uuid, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.add_cashier_to_period_roster(uuid, uuid, timestamptz, text, uuid)
  to service_role;

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
  v_period public.period;
  v_effective_date date;
  v_total_details integer;
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

  select * into v_actor from public.users where id = p_actor_id for share;
  if v_actor.id is null or not v_actor.is_active then
    raise exception 'Actor tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1 from public.role_permission
      where role = v_actor.role and permission = 'cashiers.create' and enabled = true
    ) then
    raise exception 'Actor tidak memiliki permission membuat kasir';
  end if;

  select o.* into v_outlet
  from public.outlet o
  join public.branch b on b.id = o.branch_id
  where o.id = p_outlet_id
  for share of o;
  select is_active into v_branch_active from public.branch where id = v_outlet.branch_id for share;
  if v_outlet.id is null or not v_outlet.is_active or not v_branch_active then
    raise exception 'Outlet atau cabang tidak aktif atau tidak ditemukan';
  end if;

  if v_actor.role <> 'admin'
    and not exists (
      select 1 from public.user_branch
      where user_id = v_actor.id and branch_id = v_outlet.branch_id
    ) then
    raise exception 'Actor tidak memiliki akses ke cabang outlet';
  end if;

  insert into public.cashier (name, outlet_id, employment_start_date)
  values (btrim(p_name), p_outlet_id, p_employment_start_date)
  returning * into v_cashier;

  insert into public.cashier_outlet_history (cashier_id, outlet_id)
  values (v_cashier.id, p_outlet_id);

  select * into v_period
  from public.period
  where status = 'open'
  order by start_date desc
  limit 1
  for update;

  if v_period.id is not null then
    v_effective_date := greatest(p_employment_start_date, v_period.start_date);
    select count(*)::integer into v_total_details
    from public.detail_config_history where period_id = v_period.id;

    insert into public.cashier_period_roster (
      period_id, cashier_id, outlet_id, branch_id,
      cashier_name, outlet_name, branch_name, avatar_path,
      eligible_from, entry_reason
    )
    select v_period.id, v_cashier.id, v_cashier.outlet_id, o.branch_id,
           v_cashier.name, o.name, b.name, v_cashier.avatar_url,
           v_effective_date, 'cashier_created'
    from public.outlet o
    join public.branch b on b.id = o.branch_id
    where o.id = v_cashier.outlet_id;

    insert into public.cashier_period_completion (
      period_id, cashier_id, status, total_details, assessed_details
    )
    values (v_period.id, v_cashier.id, 'not_started', v_total_details, 0);
  end if;

  return v_cashier;
end;
$$;

revoke all on function public.create_cashier_with_history(text, uuid, date, uuid)
  from public, anon, authenticated;
grant execute on function public.create_cashier_with_history(text, uuid, date, uuid)
  to service_role;

create or replace function public.open_period(p_start_date date, p_end_date date, p_performed_by uuid default null)
returns public.period
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_label text := to_char(p_start_date, 'YYYY-MM');
  v_period public.period;
  v_total_weight numeric;
  rec record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  if exists (select 1 from public.period where label = v_month_label) then
    select * into v_period from public.period where label = v_month_label;
    return v_period;
  end if;

  perform pg_advisory_xact_lock(704201);
  select coalesce(sum(weight), 0) into v_total_weight
  from public.category where is_active = true;
  if abs(v_total_weight - 100) > 0.001 then
    raise exception 'Total bobot kategori aktif harus 100 sebelum periode dibuka (saat ini %)',
      round(v_total_weight, 2);
  end if;
  if not exists (
    select 1 from public.detail d
    join public.category c on c.id = d.category_id
    where d.is_active = true and c.is_active = true
  ) then
    raise exception 'Minimal satu detail penilaian aktif wajib tersedia sebelum periode dibuka';
  end if;

  for rec in select id from public.period where status = 'open' for update
  loop
    perform public.close_period(rec.id, p_performed_by);
  end loop;

  insert into public.period (label, start_date, end_date, status)
  values (v_month_label, p_start_date, p_end_date, 'open')
  returning * into v_period;

  insert into public.category_weight_history (category_id, period_id, weight, category_name)
  select id, v_period.id, weight, name from public.category where is_active = true;

  insert into public.detail_config_history (
    detail_id, period_id, scale_max, deduction_points, category_id, detail_name, detail_type
  )
  select d.id, v_period.id, d.scale_max, d.deduction_points,
         d.category_id, d.name, d.type
  from public.detail d
  join public.category c on c.id = d.category_id and c.is_active = true
  where d.is_active = true;

  insert into public.cashier_period_roster (
    period_id, cashier_id, outlet_id, branch_id,
    cashier_name, outlet_name, branch_name, avatar_path,
    eligible_from, entry_reason
  )
  select v_period.id, c.id, c.outlet_id, o.branch_id,
         c.name, o.name, b.name, c.avatar_url,
         greatest(v_period.start_date, coalesce(c.employment_start_date, v_period.start_date)),
         'period_open'
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id and o.is_active = true
  join public.branch b on b.id = o.branch_id and b.is_active = true
  where c.is_active = true;

  insert into public.cashier_period_completion (
    period_id, cashier_id, status, total_details, assessed_details
  )
  select v_period.id, r.cashier_id, 'not_started',
         (select count(*)::integer from public.detail_config_history where period_id = v_period.id), 0
  from public.cashier_period_roster r
  where r.period_id = v_period.id
  on conflict (period_id, cashier_id) do nothing;

  insert into public.period_log (action, period_id, performed_by, detail)
  values ('open', v_period.id, p_performed_by, jsonb_build_object('label', v_period.label));
  return v_period;
end;
$$;

create or replace function public.close_period(p_period_id uuid, p_performed_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.period;
  rec record;
  existing uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  select * into v_period from public.period where id = p_period_id for update;
  if v_period.id is null then raise exception 'Periode tidak ditemukan'; end if;
  if v_period.status = 'closed' then raise exception 'Periode sudah ditutup'; end if;

  if not exists (select 1 from public.cashier_period_roster where period_id = p_period_id) then
    insert into public.cashier_period_roster (
      period_id, cashier_id, outlet_id, branch_id,
      cashier_name, outlet_name, branch_name, avatar_path,
      eligible_from, entry_reason
    )
    select p_period_id, c.id, c.outlet_id, o.branch_id,
           c.name, o.name, b.name, c.avatar_url,
           greatest(v_period.start_date, coalesce(c.employment_start_date, v_period.start_date)),
           'legacy_close_backfill'
    from public.cashier c
    join public.outlet o on o.id = c.outlet_id
    join public.branch b on b.id = o.branch_id
    where c.is_active = true;
  end if;

  for rec in
    select r.cashier_id, r.outlet_id, r.branch_id,
           r.cashier_name, r.outlet_name, r.branch_name, r.avatar_path
    from public.cashier_period_roster r
    where r.period_id = p_period_id
  loop
    perform public.recalculate_cashier_period_score(rec.cashier_id, p_period_id);

    select id into existing
    from public.leaderboard_entry
    where period_id = p_period_id and cashier_id = rec.cashier_id
    limit 1;

    if existing is null then
      insert into public.leaderboard_entry (
        period_id, cashier_id, outlet_id, branch_id,
        cashier_name, outlet_name, branch_name, avatar_path,
        total_score, category_scores
      )
      select p_period_id, rec.cashier_id, rec.outlet_id, rec.branch_id,
             rec.cashier_name, rec.outlet_name, rec.branch_name, rec.avatar_path,
             cps.total_score, cps.category_scores
      from public.cashier_period_score cps
      where cps.period_id = p_period_id and cps.cashier_id = rec.cashier_id;
    else
      update public.leaderboard_entry le
      set outlet_id = rec.outlet_id,
          branch_id = rec.branch_id,
          cashier_name = rec.cashier_name,
          outlet_name = rec.outlet_name,
          branch_name = rec.branch_name,
          avatar_path = rec.avatar_path,
          total_score = cps.total_score,
          category_scores = cps.category_scores
      from public.cashier_period_score cps
      where le.id = existing
        and cps.period_id = p_period_id and cps.cashier_id = rec.cashier_id;
    end if;
  end loop;

  for rec in select le.cashier_id from public.leaderboard_entry le where le.period_id = p_period_id
  loop
    insert into public.cashier_cumulative_score (cashier_id, cumulative_score, periods_count)
    select rec.cashier_id, round(avg(le2.total_score), 2), count(*)
    from public.leaderboard_entry le2
    where le2.cashier_id = rec.cashier_id
    on conflict (cashier_id) do update
    set cumulative_score = excluded.cumulative_score,
        periods_count = excluded.periods_count,
        updated_at = now();
  end loop;

  update public.leaderboard_entry le set rank_global = sub.r
  from (select id, row_number() over (order by total_score desc, cashier_id) as r
        from public.leaderboard_entry where period_id = p_period_id) sub
  where le.id = sub.id and le.period_id = p_period_id;

  update public.leaderboard_entry le set rank_branch = sub.r
  from (select id, row_number() over (partition by branch_id order by total_score desc, cashier_id) as r
        from public.leaderboard_entry where period_id = p_period_id) sub
  where le.id = sub.id and le.period_id = p_period_id;

  update public.leaderboard_entry le set rank_outlet = sub.r
  from (select id, row_number() over (partition by outlet_id order by total_score desc, cashier_id) as r
        from public.leaderboard_entry where period_id = p_period_id) sub
  where le.id = sub.id and le.period_id = p_period_id;

  update public.period set status = 'closed', closed_at = now() where id = p_period_id;
  update public.cashier_period_score set is_locked = true where period_id = p_period_id;

  insert into public.period_log (action, period_id, performed_by, detail)
  values ('close', p_period_id, p_performed_by, jsonb_build_object('label', v_period.label));
end;
$$;

revoke all on function public.close_period(uuid, uuid) from public, anon, authenticated;
grant execute on function public.close_period(uuid, uuid) to service_role;
revoke all on function public.open_period(date, date, uuid) from public, anon, authenticated;
grant execute on function public.open_period(date, date, uuid) to service_role;
