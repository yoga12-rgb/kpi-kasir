-- ============================================================
-- 0026_lockdown_period_rpc.sql
-- Lock down period/scoring RPCs that were previously executable
-- by PUBLIC/authenticated users.
-- ============================================================

-- Recreate the existing functions with an internal service-role guard.
-- recalculate is also called from database triggers, so trigger calls
-- are allowed while direct non-service calls remain rejected.
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

  -- Pastikan periode masih open
  if exists (select 1 from public.period where id = p_period_id and status = 'closed') then
    raise exception 'Periode sudah ditutup, tidak bisa dihitung ulang';
  end if;

  -- Loop semua kategori aktif
  for cat in
    select c.id, c.name, c.weight
    from public.category c
    where c.is_active = true
    order by c.name
  loop
    detail_scores := '{}';

    -- Kumpulkan skor normalisasi detail yang dinilai dalam kategori ini
    select array_agg(a.normalized_score)
    into detail_scores
    from public.assessment a
    join public.detail d on d.id = a.detail_id
    where a.period_id = p_period_id
      and a.cashier_id = p_cashier_id
      and d.category_id = cat.id
      and d.is_active = true;

    if detail_scores is null or array_length(detail_scores, 1) is null then
      -- Kategori belum dinilai -> 100. Perilaku scoring akan diperbaiki pada M4.3.
      cat_score := 100;
      cat_status := 'full_credit';
    else
      select avg(s) into cat_score from unnest(detail_scores) as s;
      cat_score := round(cat_score, 2);
      cat_status := 'assessed';
    end if;

    -- Bobot kategori sesuai periode
    select public.get_category_weight(p_period_id, cat.id) into cat.weight;

    cat_scores := cat_scores || jsonb_build_object(
      cat.id::text,
      jsonb_build_object(
        'name', cat.name,
        'weight', cat.weight,
        'score', cat_score,
        'status', cat_status
      )
    );

    total_weight := total_weight + coalesce(cat.weight, 0);
    weighted_sum := weighted_sum + (cat_score * coalesce(cat.weight, 0));
  end loop;

  -- Upsert skor
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

  select * into v_period from public.period where id = p_period_id;
  if v_period.id is null then
    raise exception 'Periode tidak ditemukan';
  end if;
  if v_period.status = 'closed' then
    raise exception 'Periode sudah ditutup';
  end if;

  -- Hitung ulang semua skor kasir aktif pada periode ini
  for rec in
    select c.id as cashier_id, c.outlet_id, o.branch_id
    from public.cashier c
    join public.outlet o on o.id = c.outlet_id
    where c.is_active = true
  loop
    perform public.recalculate_cashier_period_score(rec.cashier_id, p_period_id);

    -- Snapshot leaderboard entry (update jika sudah ada)
    select id into existing
    from public.leaderboard_entry
    where period_id = p_period_id and cashier_id = rec.cashier_id
    limit 1;

    if existing is null then
      insert into public.leaderboard_entry (period_id, cashier_id, outlet_id, branch_id, total_score, category_scores)
      select p_period_id, rec.cashier_id, rec.outlet_id, rec.branch_id, cps.total_score, cps.category_scores
      from public.cashier_period_score cps
      where cps.period_id = p_period_id and cps.cashier_id = rec.cashier_id;
    else
      update public.leaderboard_entry le
      set outlet_id = rec.outlet_id,
          branch_id = rec.branch_id,
          total_score = cps.total_score,
          category_scores = cps.category_scores
      from public.cashier_period_score cps
      where le.period_id = p_period_id and le.cashier_id = rec.cashier_id
        and cps.period_id = p_period_id and cps.cashier_id = rec.cashier_id;
    end if;
  end loop;

  -- Update cumulative score (rata-rata seluruh periode terkunci)
  for rec in
    select le.cashier_id
    from public.leaderboard_entry le
    where le.period_id = p_period_id
  loop
    insert into public.cashier_cumulative_score (cashier_id, cumulative_score, periods_count)
    select
      rec.cashier_id,
      round(avg(le2.total_score), 2),
      count(*)
    from public.leaderboard_entry le2
    where le2.cashier_id = rec.cashier_id
    on conflict (cashier_id) do update
    set cumulative_score = excluded.cumulative_score,
        periods_count = excluded.periods_count,
        updated_at = now();
  end loop;

  -- Update rank per level
  update public.leaderboard_entry le
  set rank_global = sub.r
  from (
    select id, row_number() over (order by total_score desc, cashier_id) as r
    from public.leaderboard_entry
    where period_id = p_period_id
  ) sub
  where le.id = sub.id and le.period_id = p_period_id;

  update public.leaderboard_entry le
  set rank_branch = sub.r
  from (
    select id, row_number() over (partition by branch_id order by total_score desc, cashier_id) as r
    from public.leaderboard_entry
    where period_id = p_period_id
  ) sub
  where le.id = sub.id and le.period_id = p_period_id;

  update public.leaderboard_entry le
  set rank_outlet = sub.r
  from (
    select id, row_number() over (partition by outlet_id order by total_score desc, cashier_id) as r
    from public.leaderboard_entry
    where period_id = p_period_id
  ) sub
  where le.id = sub.id and le.period_id = p_period_id;

  -- Kunci periode dan skor
  update public.period set status = 'closed', closed_at = now() where id = p_period_id;
  update public.cashier_period_score set is_locked = true where period_id = p_period_id;

  -- Log
  insert into public.period_log (action, period_id, performed_by, detail)
  values ('close', p_period_id, p_performed_by, jsonb_build_object('label', v_period.label));
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
  rec record;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  -- Jangan duplikat
  if exists (select 1 from public.period where label = v_month_label) then
    select * into v_period from public.period where label = v_month_label;
    return v_period;
  end if;

  -- Tutup periode open yang tersisa (jika ada)
  for rec in select id from public.period where status = 'open'
  loop
    perform public.close_period(rec.id, p_performed_by);
  end loop;

  insert into public.period (label, start_date, end_date, status)
  values (v_month_label, p_start_date, p_end_date, 'open')
  returning * into v_period;

  -- Snapshot bobot kategori ke periode baru
  insert into public.category_weight_history (category_id, period_id, weight)
  select id, v_period.id, weight from public.category where is_active = true;

  -- Snapshot config detail ke periode baru
  insert into public.detail_config_history (detail_id, period_id, scale_max, deduction_points)
  select id, v_period.id, scale_max, deduction_points from public.detail where is_active = true;

  -- Log
  insert into public.period_log (action, period_id, performed_by, detail)
  values ('open', v_period.id, p_performed_by, jsonb_build_object('label', v_month_label));

  return v_period;
end;
$$;

-- Data API must not expose these state-changing functions to anon or users.
revoke all on function public.recalculate_cashier_period_score(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.close_period(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.open_period(date, date, uuid)
  from public, anon, authenticated;

grant execute on function public.recalculate_cashier_period_score(uuid, uuid) to service_role;
grant execute on function public.close_period(uuid, uuid) to service_role;
grant execute on function public.open_period(date, date, uuid) to service_role;
