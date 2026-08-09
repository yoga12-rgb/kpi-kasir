-- ============================================================
-- 0045_completion_partial_score.sql
--
-- M4.3 correction: missing snapshot details contribute zero to
-- the temporary score until the cashier-period is complete.
-- ============================================================

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
  category_assessed_count integer;
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

    category_assessed_count := coalesce(array_length(detail_scores, 1), 0);
    if category_assessed_count = 0 then
      cat_score := 0;
      cat_status := 'not_started';
    else
      select avg(s) into cat_score from unnest(detail_scores) as s;
      if category_assessed_count < category_detail_count then
        cat_score := round(
          cat_score * category_assessed_count / nullif(category_detail_count, 0),
          2
        );
        cat_status := 'in_progress';
      else
        cat_score := round(cat_score, 2);
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

revoke all on function public.recalculate_cashier_period_score(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.recalculate_cashier_period_score(uuid, uuid) to service_role;
