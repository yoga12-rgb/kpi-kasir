-- ============================================================
-- 0003_functions_cron.sql — Fungsi skor, periode otomatis & snapshot
-- Sesuai technical-spec.md §4
-- ============================================================

-- ---------- Konstanta helper ----------
-- Ambil bobot kategori yang berlaku untuk sebuah periode.
-- Prioritas: category_weight_history → category.weight (aktif).
create or replace function public.get_category_weight(pid uuid, cid uuid)
returns numeric
language plpgsql
stable
as $$
declare
  w numeric;
begin
  select weight into w
  from public.category_weight_history
  where period_id = pid and category_id = cid
  limit 1;

  if w is null then
    select weight into w from public.category where id = cid;
  end if;

  return coalesce(w, 0);
end;
$$;

-- Ambil konfigurasi detail yang berlaku untuk sebuah periode.
create or replace function public.get_detail_config(pid uuid, did uuid)
returns table (scale_max numeric, deduction_points numeric)
language plpgsql
stable
as $$
begin
  return query
  select h.scale_max, h.deduction_points
  from public.detail_config_history h
  where h.period_id = pid and h.detail_id = did
  union all
  select d.scale_max, d.deduction_points
  from public.detail d
  where d.id = did
    and not exists (
      select 1 from public.detail_config_history h2
      where h2.period_id = pid and h2.detail_id = did
    )
  limit 1;
end;
$$;

-- ---------- Hitung & simpan skor periode satu kasir ----------
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
      -- Kategori belum dinilai → 100
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

-- ---------- Hitung normalisasi saat input assessment ----------
create or replace function public.compute_normalized_score(p_scale_value numeric, p_scale_max numeric)
returns numeric
language sql
immutable
as $$
  select case
    when p_scale_max is null or p_scale_max <= 0 then 0
    else greatest(0, least(100, round((p_scale_value / p_scale_max) * 100, 2)))
  end;
$$;

-- ---------- TRIGGER: hitung ulang skor saat assessment berubah ----------
create or replace function public.on_assessment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_cashier_period_score(old.cashier_id, old.period_id);
    return old;
  end if;
  perform public.recalculate_cashier_period_score(new.cashier_id, new.period_id);
  return new;
end;
$$;

drop trigger if exists assessment_recalc on public.assessment;
create trigger assessment_recalc
  after insert or update or delete on public.assessment
  for each row execute function public.on_assessment_change();

-- ---------- TRIGGER: hitung ulang skor saat kejadian deduksi berubah ----------
-- Skor normalisasi detail deduction = 100 - total poin seluruh kejadian (floor 0).
-- Poin per kejadian disalin dari konfigurasi saat kejadian dibuat (di aplikasi),
-- sehingga non-retroaktif terjaga (kejadian lama tetap pakai poin lama).
create or replace function public.on_deduction_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id uuid;
  v_cashier_id uuid;
begin
  select a.period_id, a.cashier_id into v_period_id, v_cashier_id
  from public.assessment a where a.id = new.assessment_id;

  update public.assessment
  set normalized_score = greatest(0, 100 - coalesce((
    select sum(e.points) from public.deduction_event e
    where e.assessment_id = new.assessment_id
  ), 0))
  where id = new.assessment_id;

  perform public.recalculate_cashier_period_score(v_cashier_id, v_period_id);
  return new;
end;
$$;

create or replace function public.on_deduction_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period_id uuid;
  v_cashier_id uuid;
begin
  select a.period_id, a.cashier_id into v_period_id, v_cashier_id
  from public.assessment a where a.id = old.assessment_id;

  update public.assessment
  set normalized_score = greatest(0, 100 - coalesce((
    select sum(e.points) from public.deduction_event e
    where e.assessment_id = old.assessment_id
  ), 0))
  where id = old.assessment_id;

  perform public.recalculate_cashier_period_score(v_cashier_id, v_period_id);
  return old;
end;
$$;

drop trigger if exists deduction_event_recalc on public.deduction_event;
create trigger deduction_event_recalc_insert
  after insert on public.deduction_event
  for each row execute function public.on_deduction_insert();

create trigger deduction_event_recalc_delete
  after delete on public.deduction_event
  for each row execute function public.on_deduction_delete();

-- ---------- TUTUP PERIODE ----------
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

  -- Kunci periode & skor
  update public.period set status = 'closed', closed_at = now() where id = p_period_id;
  update public.cashier_period_score set is_locked = true where period_id = p_period_id;

  -- Log
  insert into public.period_log (action, period_id, performed_by, detail)
  values ('close', p_period_id, p_performed_by, jsonb_build_object('label', v_period.label));
end;
$$;

-- ---------- BUKA PERIODE BARU ----------
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

-- ---------- CRON: jadwal otomatis bulanan ----------
-- Dijalankan via pg_cron (perlu ekstensi pg_cron aktif) atau via cron Vercel
-- yang memanggil endpoint /api/cron/periods.
-- Contoh pg_cron (aktifkan sesuai environment):
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'open-period-monthly',
--     '0 0 1 * *',
--     $$ select public.open_period(
--          date_trunc('month', now())::date,
--          (date_trunc('month', now()) + interval '1 month - 1 day')::date
--        ); $$
--   );