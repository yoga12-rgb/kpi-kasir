-- ============================================================
-- 0056_assessment_configuration_archive.sql
--
-- Archive assessment configuration without deleting historical data.
-- Category/detail status changes are service-role RPCs with audit logs.
-- ============================================================

-- Historical configuration must not be removed through a cascading delete.
alter table public.detail
  drop constraint if exists detail_category_id_fkey;
alter table public.detail
  add constraint detail_category_id_fkey
  foreign key (category_id) references public.category (id) on delete restrict;

alter table public.category_weight_history
  drop constraint if exists category_weight_history_category_id_fkey;
alter table public.category_weight_history
  add constraint category_weight_history_category_id_fkey
  foreign key (category_id) references public.category (id) on delete restrict;

alter table public.detail_config_history
  drop constraint if exists detail_config_history_detail_id_fkey;
alter table public.detail_config_history
  add constraint detail_config_history_detail_id_fkey
  foreign key (detail_id) references public.detail (id) on delete restrict;

alter table public.assessment
  drop constraint if exists assessment_detail_id_fkey;
alter table public.assessment
  add constraint assessment_detail_id_fkey
  foreign key (detail_id) references public.detail (id) on delete restrict;

create or replace function public.admin_set_category_status(
  p_actor_id uuid,
  p_category_id uuid,
  p_is_active boolean,
  p_reason text
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
  v_reason text := btrim(coalesce(p_reason, ''));
  v_total numeric;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  if p_is_active is null then
    raise exception 'Status kategori wajib diisi';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Alasan perubahan harus 3 sampai 500 karakter';
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

  if v_before.is_active = p_is_active then
    return v_before;
  end if;

  if p_is_active then
    select coalesce(sum(weight), 0) into v_total
    from public.category
    where is_active = true and id <> v_before.id;
    if v_total + v_before.weight > 100.001 then
      raise exception 'Total bobot aktif setelah pemulihan melebihi 100%% (akan menjadi %)',
        round(v_total + v_before.weight, 2);
    end if;
  end if;

  update public.category
  set is_active = p_is_active
  where id = v_before.id
  returning * into v_after;

  insert into public.audit_log (
    actor_id, action, entity_type, entity_id, before_data, after_data
  )
  values (
    p_actor_id,
    case when p_is_active then 'category.restored' else 'category.archived' end,
    'category',
    v_after.id,
    jsonb_build_object(
      'id', v_before.id,
      'name', v_before.name,
      'weight', v_before.weight,
      'is_active', v_before.is_active
    ),
    jsonb_build_object(
      'id', v_after.id,
      'name', v_after.name,
      'weight', v_after.weight,
      'is_active', v_after.is_active,
      'reason', v_reason
    )
  );

  return v_after;
end;
$$;

create or replace function public.admin_set_detail_status(
  p_actor_id uuid,
  p_detail_id uuid,
  p_is_active boolean,
  p_reason text
)
returns public.detail
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor public.users;
  v_before public.detail;
  v_after public.detail;
  v_category_active boolean;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'RPC hanya dapat dipanggil oleh service role';
  end if;
  if p_is_active is null then
    raise exception 'Status detail wajib diisi';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Alasan perubahan harus 3 sampai 500 karakter';
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
  from public.detail
  where id = p_detail_id
  for update;
  if v_before.id is null then
    raise exception 'Detail tidak ditemukan';
  end if;

  select is_active into v_category_active
  from public.category
  where id = v_before.category_id;
  if v_category_active is null then
    raise exception 'Kategori detail tidak ditemukan';
  end if;
  if p_is_active and not v_category_active then
    raise exception 'Kategori parent masih diarsipkan';
  end if;

  if v_before.is_active = p_is_active then
    return v_before;
  end if;

  update public.detail
  set is_active = p_is_active
  where id = v_before.id
  returning * into v_after;

  insert into public.audit_log (
    actor_id, action, entity_type, entity_id, before_data, after_data
  )
  values (
    p_actor_id,
    case when p_is_active then 'detail.restored' else 'detail.archived' end,
    'detail',
    v_after.id,
    jsonb_build_object(
      'id', v_before.id,
      'category_id', v_before.category_id,
      'name', v_before.name,
      'type', v_before.type,
      'scale_max', v_before.scale_max,
      'deduction_points', v_before.deduction_points,
      'is_active', v_before.is_active
    ),
    jsonb_build_object(
      'id', v_after.id,
      'category_id', v_after.category_id,
      'name', v_after.name,
      'type', v_after.type,
      'scale_max', v_after.scale_max,
      'deduction_points', v_after.deduction_points,
      'is_active', v_after.is_active,
      'reason', v_reason
    )
  );

  return v_after;
end;
$$;

-- The legacy update RPC remains available for name/weight edits, but status
-- transitions must use the audited status RPC above.
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
  if p_is_active is not null and p_is_active <> v_before.is_active then
    raise exception 'Perubahan status kategori harus melalui admin_set_category_status';
  end if;

  v_next_name := coalesce(nullif(btrim(p_name), ''), v_before.name);
  v_next_weight := coalesce(p_weight, v_before.weight);
  if char_length(v_next_name) < 2 or char_length(v_next_name) > 100 then
    raise exception 'Nama kategori harus 2 sampai 100 karakter';
  end if;
  if v_next_weight < 0 or v_next_weight > 100 then
    raise exception 'Bobot kategori harus antara 0 dan 100';
  end if;

  select coalesce(sum(weight), 0) into v_total
  from public.category
  where is_active = true and id <> v_before.id;
  if v_before.is_active then
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
      weight = v_next_weight
  where id = v_before.id
  returning * into v_after;
  return v_after;
end;
$$;

revoke all on function public.admin_set_category_status(uuid, uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.admin_set_detail_status(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.admin_set_category_status(uuid, uuid, boolean, text)
  to service_role;
grant execute on function public.admin_set_detail_status(uuid, uuid, boolean, text)
  to service_role;
