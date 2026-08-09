-- ============================================================
-- 0047_period_preflight_and_override.sql
--
-- M4.5: lifecycle preflight, overlap protection, idempotent close,
-- and explicit admin override for incomplete periods.
-- ============================================================

create unique index if not exists period_one_open_idx
  on public.period ((status))
  where status = 'open';

create or replace function public.get_period_close_preflight(p_period_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.period;
  v_total_weight numeric;
  v_total_details integer;
  v_incomplete_count integer;
  v_incomplete jsonb;
  v_preview jsonb;
  v_config_valid boolean;
  v_config_issues jsonb := '[]'::jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  select * into v_period from public.period where id = p_period_id;
  if v_period.id is null then raise exception 'Periode tidak ditemukan'; end if;

  select coalesce(sum(weight), 0) into v_total_weight
  from public.category_weight_history where period_id = p_period_id;
  select count(*)::integer into v_total_details
  from public.detail_config_history where period_id = p_period_id;

  if abs(v_total_weight - 100) > 0.001 then
    v_config_issues := v_config_issues || jsonb_build_array(
      format('Total bobot snapshot harus 100, saat ini %s', round(v_total_weight, 2))
    );
  end if;
  if v_total_details = 0 then
    v_config_issues := v_config_issues || jsonb_build_array(
      'Snapshot periode tidak memiliki detail penilaian'
    );
  end if;
  v_config_valid := jsonb_array_length(v_config_issues) = 0;

  select count(*)::integer into v_incomplete_count
  from public.cashier_period_roster r
  left join public.cashier_period_completion cpc
    on cpc.period_id = r.period_id and cpc.cashier_id = r.cashier_id
  where r.period_id = p_period_id
    and coalesce(cpc.status, 'not_started') <> 'complete';

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_incomplete
  from (
    select r.cashier_id, r.cashier_name, r.outlet_name, r.branch_name,
           coalesce(cpc.status, 'not_started') as status,
           coalesce(cpc.assessed_details, 0) as assessed_details,
           coalesce(cpc.total_details, v_total_details) as total_details
    from public.cashier_period_roster r
    left join public.cashier_period_completion cpc
      on cpc.period_id = r.period_id and cpc.cashier_id = r.cashier_id
    where r.period_id = p_period_id
      and coalesce(cpc.status, 'not_started') <> 'complete'
    order by r.branch_name, r.outlet_name, r.cashier_name
    limit 100
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v_preview
  from (
    select r.cashier_id, r.cashier_name, r.outlet_name, r.branch_name,
           coalesce(cps.total_score, 0) as total_score
    from public.cashier_period_roster r
    left join public.cashier_period_score cps
      on cps.period_id = r.period_id and cps.cashier_id = r.cashier_id
    where r.period_id = p_period_id
    order by coalesce(cps.total_score, 0) desc, r.cashier_id
    limit 10
  ) x;

  return jsonb_build_object(
    'periodId', v_period.id,
    'label', v_period.label,
    'status', v_period.status,
    'startDate', v_period.start_date,
    'endDate', v_period.end_date,
    'configValid', v_config_valid,
    'configIssues', v_config_issues,
    'incompleteCount', v_incomplete_count,
    'incompleteCashiers', v_incomplete,
    'rankingPreview', v_preview,
    'canClose', v_config_valid and v_incomplete_count = 0
  );
end;
$$;

revoke all on function public.get_period_close_preflight(uuid)
  from public, anon, authenticated;
grant execute on function public.get_period_close_preflight(uuid) to service_role;

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
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Rentang tanggal periode tidak valid';
  end if;

  perform pg_advisory_xact_lock(704201);

  select * into v_period from public.period where label = v_month_label;
  if v_period.id is not null then
    if v_period.start_date <> p_start_date or v_period.end_date <> p_end_date then
      raise exception 'Periode dengan label tersebut sudah ada dengan tanggal berbeda';
    end if;
    return v_period;
  end if;

  if exists (
    select 1 from public.period p
    where p_start_date <= p.end_date and p_end_date >= p.start_date
  ) then
    raise exception 'Rentang periode bertumpang tindih dengan periode yang sudah ada';
  end if;

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

create or replace function public.close_period(
  p_period_id uuid,
  p_performed_by uuid,
  p_override_incomplete boolean,
  p_override_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.period;
  v_actor public.users;
  v_preflight jsonb;
  v_incomplete_count integer;
  rec record;
  existing uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;

  select * into v_period from public.period where id = p_period_id for update;
  if v_period.id is null then raise exception 'Periode tidak ditemukan'; end if;
  if v_period.status = 'closed' then return; end if;

  v_preflight := public.get_period_close_preflight(p_period_id);
  if coalesce((v_preflight ->> 'configValid')::boolean, false) is false then
    raise exception 'Konfigurasi snapshot periode tidak valid: %', v_preflight -> 'configIssues';
  end if;

  v_incomplete_count := coalesce((v_preflight ->> 'incompleteCount')::integer, 0);
  if v_incomplete_count > 0 then
    if not coalesce(p_override_incomplete, false) then
      raise exception 'Masih ada % cashier incomplete; gunakan override admin dengan alasan', v_incomplete_count;
    end if;
    if p_performed_by is null or char_length(btrim(coalesce(p_override_reason, ''))) < 3
      or char_length(btrim(coalesce(p_override_reason, ''))) > 500 then
      raise exception 'Alasan override incomplete wajib diisi';
    end if;
    select * into v_actor from public.users where id = p_performed_by for share;
    if v_actor.id is null or not v_actor.is_active or v_actor.role <> 'admin' then
      raise exception 'Override incomplete hanya boleh dilakukan admin aktif';
    end if;
  elsif coalesce(p_override_incomplete, false) then
    raise exception 'Override tidak diperlukan karena seluruh roster sudah complete';
  end if;

  if not exists (select 1 from public.cashier_period_roster where period_id = p_period_id) then
    raise exception 'Roster periode tidak tersedia';
  end if;

  for rec in
    select r.cashier_id, r.outlet_id, r.branch_id,
           r.cashier_name, r.outlet_name, r.branch_name, r.avatar_path
    from public.cashier_period_roster r
    where r.period_id = p_period_id
  loop
    perform public.recalculate_cashier_period_score(rec.cashier_id, p_period_id);

    select id into existing from public.leaderboard_entry
    where period_id = p_period_id and cashier_id = rec.cashier_id limit 1;

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
    from public.leaderboard_entry le2 where le2.cashier_id = rec.cashier_id
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
  values (
    'close', p_period_id, p_performed_by,
    jsonb_build_object(
      'label', v_period.label,
      'override_incomplete', coalesce(p_override_incomplete, false),
      'override_reason', nullif(btrim(p_override_reason), ''),
      'incomplete_count', v_incomplete_count
    )
  );
end;
$$;

create or replace function public.close_period(p_period_id uuid, p_performed_by uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.close_period(p_period_id, p_performed_by, false, null);
end;
$$;

revoke all on function public.close_period(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.close_period(uuid, uuid, boolean, text) to service_role;
revoke all on function public.close_period(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.close_period(uuid, uuid) to service_role;
revoke all on function public.open_period(date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.open_period(date, date, uuid) to service_role;
