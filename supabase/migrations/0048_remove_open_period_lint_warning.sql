-- M4.5 correction: remove an unused declaration from the latest open_period body.

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

revoke all on function public.open_period(date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.open_period(date, date, uuid) to service_role;
