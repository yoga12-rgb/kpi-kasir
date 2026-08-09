-- ============================================================
-- 0042_category_configuration_validation.sql
--
-- M4.1: category/detail configuration validation.
-- Config writes are service-role RPCs with an advisory transaction lock;
-- opening a period has a final database-side precondition check.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'category_name_check'
      and conrelid = 'public.category'::regclass
  ) then
    alter table public.category
      add constraint category_name_check
      check (char_length(btrim(name)) between 2 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'detail_name_check'
      and conrelid = 'public.detail'::regclass
  ) then
    alter table public.detail
      add constraint detail_name_check
      check (char_length(btrim(name)) between 2 and 150);
  end if;
end;
$$;

revoke insert, update, delete on public.category from authenticated;
revoke insert, update, delete on public.detail from authenticated;

create or replace function public.admin_create_category(
  p_actor_id uuid,
  p_name text,
  p_weight numeric
)
returns public.category
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_category public.category;
  v_total numeric;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  select * into v_actor from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then raise exception 'Actor admin tidak valid'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Nama kategori harus 2 sampai 100 karakter';
  end if;
  if p_weight is null or p_weight < 0 or p_weight > 100 then
    raise exception 'Bobot kategori harus antara 0 dan 100';
  end if;

  perform pg_advisory_xact_lock(704201);
  select coalesce(sum(weight), 0) into v_total
  from public.category where is_active = true;
  if abs(v_total + p_weight - 100) > 0.001 then
    raise exception 'Total bobot aktif setelah perubahan harus 100 (akan menjadi %)', round(v_total + p_weight, 2);
  end if;

  insert into public.category (name, weight)
  values (v_name, p_weight)
  returning * into v_category;
  return v_category;
end;
$$;

create or replace function public.admin_update_category(
  p_actor_id uuid,
  p_category_id uuid,
  p_name text default null,
  p_weight numeric default null,
  p_is_active boolean default null
)
returns public.category
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_before public.category;
  v_after public.category;
  v_next_name text;
  v_next_weight numeric;
  v_next_active boolean;
  v_total numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  select * into v_actor from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then raise exception 'Actor admin tidak valid'; end if;

  perform pg_advisory_xact_lock(704201);
  select * into v_before from public.category where id = p_category_id for update;
  if v_before.id is null then raise exception 'Kategori tidak ditemukan'; end if;

  v_next_name := coalesce(nullif(btrim(p_name), ''), v_before.name);
  v_next_weight := coalesce(p_weight, v_before.weight);
  v_next_active := coalesce(p_is_active, v_before.is_active);
  if char_length(v_next_name) < 2 or char_length(v_next_name) > 100 then
    raise exception 'Nama kategori harus 2 sampai 100 karakter';
  end if;
  if v_next_weight < 0 or v_next_weight > 100 then
    raise exception 'Bobot kategori harus antara 0 dan 100';
  end if;

  select coalesce(sum(weight), 0) into v_total
  from public.category
  where is_active = true and id <> v_before.id;
  if v_next_active then v_total := v_total + v_next_weight; end if;
  if abs(v_total - 100) > 0.001 then
    raise exception 'Total bobot aktif setelah perubahan harus 100 (akan menjadi %)', round(v_total, 2);
  end if;

  update public.category
  set name = v_next_name,
      weight = v_next_weight,
      is_active = v_next_active
  where id = v_before.id
  returning * into v_after;
  return v_after;
end;
$$;

create or replace function public.admin_create_detail(
  p_actor_id uuid,
  p_category_id uuid,
  p_name text,
  p_type public.detail_type,
  p_scale_max numeric default null,
  p_deduction_points numeric default null
)
returns public.detail
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_detail public.detail;
  v_name text := btrim(coalesce(p_name, ''));
  v_category_active boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  select * into v_actor from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then raise exception 'Actor admin tidak valid'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 150 then
    raise exception 'Nama detail harus 2 sampai 150 karakter';
  end if;

  select is_active into v_category_active
  from public.category where id = p_category_id;
  if not coalesce(v_category_active, false) then
    raise exception 'Kategori tidak ditemukan atau tidak aktif';
  end if;

  if p_type = 'scale' then
    if p_scale_max is null or p_scale_max <= 0 or p_deduction_points is not null then
      raise exception 'Detail skala wajib memiliki scale_max positif saja';
    end if;
  elsif p_type = 'deduction' then
    if p_deduction_points is null or p_deduction_points <= 0 or p_scale_max is not null then
      raise exception 'Detail deduksi wajib memiliki deduction_points positif saja';
    end if;
  else
    raise exception 'Tipe detail tidak valid';
  end if;

  insert into public.detail (category_id, name, type, scale_max, deduction_points)
  values (
    p_category_id,
    v_name,
    p_type,
    case when p_type = 'scale' then p_scale_max else null end,
    case when p_type = 'deduction' then p_deduction_points else null end
  )
  returning * into v_detail;
  return v_detail;
end;
$$;

revoke all on function public.admin_create_category(uuid, text, numeric)
  from public, anon, authenticated;
revoke all on function public.admin_update_category(uuid, uuid, text, numeric, boolean)
  from public, anon, authenticated;
revoke all on function public.admin_create_detail(uuid, uuid, text, public.detail_type, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.admin_create_category(uuid, text, numeric) to service_role;
grant execute on function public.admin_update_category(uuid, uuid, text, numeric, boolean) to service_role;
grant execute on function public.admin_create_detail(uuid, uuid, text, public.detail_type, numeric, numeric)
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

  insert into public.category_weight_history (category_id, period_id, weight)
  select id, v_period.id, weight from public.category where is_active = true;

  insert into public.detail_config_history (detail_id, period_id, scale_max, deduction_points)
  select id, v_period.id, scale_max, deduction_points from public.detail where is_active = true;

  insert into public.period_log (action, period_id, performed_by, detail)
  values ('open', v_period.id, p_performed_by, jsonb_build_object('label', v_period.label));

  return v_period;
end;
$$;

revoke all on function public.open_period(date, date, uuid)
  from public, anon, authenticated;
grant execute on function public.open_period(date, date, uuid) to service_role;
