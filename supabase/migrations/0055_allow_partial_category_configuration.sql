-- ============================================================
-- 0055_allow_partial_category_configuration.sql
--
-- Category configuration can be assembled incrementally. The active
-- total may stay below 100 during setup, but it can never exceed 100.
-- open_period remains responsible for requiring exactly 100 before a
-- scoring period is created.
-- ============================================================

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

  select * into v_actor
  from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then
    raise exception 'Actor admin tidak valid';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 100 then
    raise exception 'Nama kategori harus 2 sampai 100 karakter';
  end if;
  if p_weight is null or p_weight < 0 or p_weight > 100 then
    raise exception 'Bobot kategori harus antara 0 dan 100';
  end if;

  perform pg_advisory_xact_lock(704201);
  select coalesce(sum(weight), 0) into v_total
  from public.category
  where is_active = true;

  if v_total + p_weight > 100.001 then
    raise exception '%', format(
      'Total bobot aktif tidak boleh melebihi 100%% (akan menjadi %s%%)',
      round(v_total + p_weight, 2)
    );
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

  select * into v_actor
  from public.users
  where id = p_actor_id and role = 'admin' and is_active = true
  for update;
  if v_actor.id is null then
    raise exception 'Actor admin tidak valid';
  end if;

  perform pg_advisory_xact_lock(704201);
  select * into v_before
  from public.category
  where id = p_category_id
  for update;
  if v_before.id is null then
    raise exception 'Kategori tidak ditemukan';
  end if;

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
  if v_next_active then
    v_total := v_total + v_next_weight;
  end if;
  if v_total > 100.001 then
    raise exception '%', format(
      'Total bobot aktif tidak boleh melebihi 100%% (akan menjadi %s%%)',
      round(v_total, 2)
    );
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

revoke all on function public.admin_create_category(uuid, text, numeric)
  from public, anon, authenticated;
revoke all on function public.admin_update_category(uuid, uuid, text, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.admin_create_category(uuid, text, numeric) to service_role;
grant execute on function public.admin_update_category(uuid, uuid, text, numeric, boolean) to service_role;
