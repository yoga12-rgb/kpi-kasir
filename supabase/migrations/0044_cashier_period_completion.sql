-- ============================================================
-- 0044_cashier_period_completion.sql
--
-- M4.3: pisahkan status kelengkapan penilaian dari skor sementara.
-- ============================================================

create table if not exists public.cashier_period_completion (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.period (id) on delete cascade,
  cashier_id uuid not null references public.cashier (id) on delete cascade,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'complete')),
  total_details integer not null default 0 check (total_details >= 0),
  assessed_details integer not null default 0 check (assessed_details >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (period_id, cashier_id),
  check (assessed_details <= total_details)
);

create index if not exists cashier_period_completion_period_idx
  on public.cashier_period_completion (period_id, status);

create index if not exists cashier_period_completion_cashier_idx
  on public.cashier_period_completion (cashier_id, period_id);

alter table public.cashier_period_completion enable row level security;

create policy "cpc_select_access" on public.cashier_period_completion
  for select to authenticated
  using (public.user_has_cashier_access(cashier_id));

create policy "active_user_guard" on public.cashier_period_completion
  as restrictive for all to authenticated
  using (public.is_active_user())
  with check (public.is_active_user());

grant select on public.cashier_period_completion to authenticated;
grant all on public.cashier_period_completion to service_role;

-- Backfill the currently open period without changing closed historical periods.
insert into public.cashier_period_completion (
  period_id,
  cashier_id,
  status,
  total_details,
  assessed_details,
  completed_at
)
select
  p.id,
  c.id,
  case
    when count(distinct a.detail_id) = 0 then 'not_started'
    when count(distinct a.detail_id) < count(distinct dch.detail_id) then 'in_progress'
    else 'complete'
  end,
  count(distinct dch.detail_id)::integer,
  count(distinct a.detail_id)::integer,
  case when count(distinct dch.detail_id) > 0
         and count(distinct a.detail_id) = count(distinct dch.detail_id)
       then now() end
from public.period p
join public.cashier c on c.is_active = true
join public.outlet o on o.id = c.outlet_id and o.is_active = true
join public.branch b on b.id = o.branch_id and b.is_active = true
left join public.detail_config_history dch on dch.period_id = p.id
left join public.assessment a
  on a.period_id = p.id and a.cashier_id = c.id and a.detail_id = dch.detail_id
where p.status = 'open'
group by p.id, c.id
on conflict (period_id, cashier_id) do update
set status = excluded.status,
    total_details = excluded.total_details,
    assessed_details = excluded.assessed_details,
    completed_at = excluded.completed_at,
    updated_at = now();

create or replace function public.recalculate_cashier_period_score(p_cashier_id uuid, p_period_id uuid)
returns public.cashier_period_score
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.cashier_period_score;
  cat record;
  detail_scores numeric[];
  cat_score numeric;
  cat_status text;
  category_detail_count integer;
  total_weight numeric := 0;
  weighted_sum numeric := 0;
  total_details integer := 0;
  assessed_details integer := 0;
  completion_status text;
  completion_at timestamptz;
  cat_scores jsonb := '{}'::jsonb;
  existing public.cashier_period_score;
begin
  if pg_trigger_depth() = 0 and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role atau trigger internal';
  end if;

  if exists (select 1 from public.period where id = p_period_id and status = 'closed') then
    raise exception 'Periode sudah ditutup, tidak bisa dihitung ulang';
  end if;

  select count(*)::integer into total_details
  from public.detail_config_history h
  where h.period_id = p_period_id;

  select count(distinct a.detail_id)::integer into assessed_details
  from public.assessment a
  join public.detail_config_history h
    on h.period_id = a.period_id and h.detail_id = a.detail_id
  where a.period_id = p_period_id and a.cashier_id = p_cashier_id;

  if assessed_details = 0 then
    completion_status := 'not_started';
  elsif total_details > 0 and assessed_details < total_details then
    completion_status := 'in_progress';
  else
    completion_status := 'complete';
  end if;

  if completion_status = 'complete' then
    completion_at := coalesce(
      (select completed_at
       from public.cashier_period_completion
       where period_id = p_period_id and cashier_id = p_cashier_id),
      now()
    );
  else
    completion_at := null;
  end if;

  for cat in
    select h.category_id, h.category_name, h.weight
    from public.category_weight_history h
    where h.period_id = p_period_id
    order by h.category_name, h.category_id
  loop
    select count(*)::integer into category_detail_count
    from public.detail_config_history h
    where h.period_id = p_period_id and h.category_id = cat.category_id;

    select array_agg(a.normalized_score)
    into detail_scores
    from public.assessment a
    join public.detail_config_history h
      on h.period_id = a.period_id
     and h.detail_id = a.detail_id
     and h.category_id = cat.category_id
    where a.period_id = p_period_id
      and a.cashier_id = p_cashier_id;

    if detail_scores is null or array_length(detail_scores, 1) is null then
      cat_score := 0;
      cat_status := 'not_started';
    else
      select avg(s) into cat_score from unnest(detail_scores) as s;
      cat_score := round(cat_score, 2);
      if array_length(detail_scores, 1) < category_detail_count then
        cat_status := 'in_progress';
      else
        cat_status := 'complete';
      end if;
    end if;

    cat_scores := cat_scores || jsonb_build_object(
      cat.category_id::text,
      jsonb_build_object(
        'name', cat.category_name,
        'weight', cat.weight,
        'score', cat_score,
        'status', cat_status
      )
    );

    total_weight := total_weight + coalesce(cat.weight, 0);
    weighted_sum := weighted_sum + (cat_score * coalesce(cat.weight, 0));
  end loop;

  select * into existing
  from public.cashier_period_score
  where period_id = p_period_id and cashier_id = p_cashier_id
  limit 1;

  if existing.id is null then
    insert into public.cashier_period_score (period_id, cashier_id, total_score, category_scores)
    values (
      p_period_id,
      p_cashier_id,
      case when total_weight > 0 then round(weighted_sum / total_weight, 2) else 0 end,
      cat_scores
    )
    returning * into result;
  else
    update public.cashier_period_score
    set total_score = case when total_weight > 0 then round(weighted_sum / total_weight, 2) else 0 end,
        category_scores = cat_scores,
        is_locked = false,
        updated_at = now()
    where id = existing.id
    returning * into result;
  end if;

  insert into public.cashier_period_completion (
    period_id, cashier_id, status, total_details, assessed_details, completed_at
  )
  values (
    p_period_id, p_cashier_id, completion_status, total_details, assessed_details, completion_at
  )
  on conflict (period_id, cashier_id) do update
  set status = excluded.status,
      total_details = excluded.total_details,
      assessed_details = excluded.assessed_details,
      completed_at = excluded.completed_at,
      updated_at = now();

  return result;
end;
$$;

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
    select 1
    from public.detail d
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
  select id, v_period.id, weight, name
  from public.category
  where is_active = true;

  insert into public.detail_config_history (
    detail_id, period_id, scale_max, deduction_points, category_id, detail_name, detail_type
  )
  select d.id, v_period.id, d.scale_max, d.deduction_points,
         d.category_id, d.name, d.type
  from public.detail d
  join public.category c on c.id = d.category_id and c.is_active = true
  where d.is_active = true;

  insert into public.cashier_period_completion (
    period_id, cashier_id, status, total_details, assessed_details
  )
  select v_period.id, c.id, 'not_started',
         (select count(*)::integer from public.detail_config_history where period_id = v_period.id),
         0
  from public.cashier c
  join public.outlet o on o.id = c.outlet_id and o.is_active = true
  join public.branch b on b.id = o.branch_id and b.is_active = true
  where c.is_active = true;

  insert into public.period_log (action, period_id, performed_by, detail)
  values ('open', v_period.id, p_performed_by, jsonb_build_object('label', v_period.label));
  return v_period;
end;
$$;

revoke all on function public.recalculate_cashier_period_score(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.recalculate_cashier_period_score(uuid, uuid) to service_role;

revoke all on function public.open_period(date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.open_period(date, date, uuid) to service_role;
