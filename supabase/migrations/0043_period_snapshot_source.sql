-- ============================================================
-- 0043_period_snapshot_source.sql
--
-- M4.2: snapshot period menjadi source of truth.
-- Category/detail yang berubah setelah period dibuka tidak mengubah
-- rekalkulasi atau validasi assessment pada period tersebut.
-- ============================================================

alter table public.category_weight_history
  add column if not exists category_name text;

alter table public.detail_config_history
  add column if not exists category_id uuid,
  add column if not exists detail_name text,
  add column if not exists detail_type public.detail_type;

update public.category_weight_history h
set category_name = c.name
from public.category c
where c.id = h.category_id
  and h.category_name is null;

update public.detail_config_history h
set category_id = d.category_id,
    detail_name = d.name,
    detail_type = d.type
from public.detail d
where d.id = h.detail_id
  and (h.category_id is null or h.detail_name is null or h.detail_type is null);

create index if not exists detail_config_history_period_category_idx
  on public.detail_config_history (period_id, category_id);

create or replace function public.get_category_weight(pid uuid, cid uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select weight
  from public.category_weight_history
  where period_id = $1 and category_id = $2
  limit 1
$$;

create or replace function public.get_detail_config(pid uuid, did uuid)
returns table (scale_max numeric, deduction_points numeric)
language sql
stable
security definer
set search_path = public
as $$
  select h.scale_max, h.deduction_points
  from public.detail_config_history h
  where h.period_id = $1 and h.detail_id = $2
  limit 1
$$;

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
  total_weight numeric := 0;
  weighted_sum numeric := 0;
  cat_scores jsonb := '{}'::jsonb;
  existing public.cashier_period_score;
begin
  if pg_trigger_depth() = 0 and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role atau trigger internal';
  end if;

  if exists (select 1 from public.period where id = p_period_id and status = 'closed') then
    raise exception 'Periode sudah ditutup, tidak bisa dihitung ulang';
  end if;

  for cat in
    select h.category_id, h.category_name, h.weight
    from public.category_weight_history h
    where h.period_id = p_period_id
    order by h.category_name, h.category_id
  loop
    detail_scores := '{}';

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
      cat_score := 100;
      cat_status := 'full_credit';
    else
      select avg(s) into cat_score from unnest(detail_scores) as s;
      cat_score := round(cat_score, 2);
      cat_status := 'assessed';
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

  return result;
end;
$$;

-- Assessment may use a detail that was active in the period snapshot even
-- after the current detail flag is changed.
drop policy if exists "assessment_insert_access" on public.assessment;
create policy "assessment_insert_access" on public.assessment
  for insert to authenticated
  with check (
    public.user_has_permission('assessment')
    and exists (
      select 1 from public.period p
      where p.id = public.assessment.period_id and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
    and exists (
      select 1 from public.detail_config_history h
      where h.period_id = public.assessment.period_id
        and h.detail_id = public.assessment.detail_id
    )
  );

drop policy if exists "assessment_update_access" on public.assessment;
create policy "assessment_update_access" on public.assessment
  for update to authenticated
  using (
    public.user_has_permission('assessment')
    and exists (
      select 1 from public.period p
      where p.id = public.assessment.period_id and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
  )
  with check (
    public.user_has_permission('assessment')
    and exists (
      select 1 from public.period p
      where p.id = public.assessment.period_id and p.status = 'open'
    )
    and public.user_has_cashier_access(public.assessment.cashier_id)
    and exists (
      select 1 from public.detail_config_history h
      where h.period_id = public.assessment.period_id
        and h.detail_id = public.assessment.detail_id
    )
  );

drop policy if exists "de_insert_access" on public.deduction_event;
create policy "de_insert_access" on public.deduction_event
  for insert to authenticated
  with check (
    public.user_has_permission('assessment')
    and public.deduction_event.created_by = auth.uid()
    and exists (
      select 1
      from public.assessment a
      join public.period p on p.id = a.period_id
      join public.detail_config_history h
        on h.period_id = a.period_id and h.detail_id = a.detail_id
      where a.id = public.deduction_event.assessment_id
        and h.detail_type = 'deduction'
        and p.status = 'open'
        and public.user_has_cashier_access(a.cashier_id)
    )
  );

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
    detail_id,
    period_id,
    scale_max,
    deduction_points,
    category_id,
    detail_name,
    detail_type
  )
  select d.id, v_period.id, d.scale_max, d.deduction_points,
         d.category_id, d.name, d.type
  from public.detail d
  join public.category c on c.id = d.category_id and c.is_active = true
  where d.is_active = true;

  insert into public.period_log (action, period_id, performed_by, detail)
  values ('open', v_period.id, p_performed_by, jsonb_build_object('label', v_period.label));
  return v_period;
end;
$$;

revoke all on function public.open_period(date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.open_period(date, date, uuid) to service_role;
