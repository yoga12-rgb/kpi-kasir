-- ============================================================
-- 0057_dashboard_snapshot.sql
--
-- Read-only, role-scoped dashboard aggregation. This avoids the
-- request waterfall previously created by multiple PostgREST queries.
-- ============================================================

create or replace function public.get_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_period record;
  v_branch_ids uuid[] := '{}'::uuid[];
  v_is_admin boolean := false;
  v_can_assessment boolean := false;
  v_can_leaderboard boolean := false;
  v_can_mentoring boolean := false;
  v_can_cashiers boolean := false;
  v_has_branches boolean := false;
  v_cashier_count integer := 0;
  v_complete_count integer := 0;
  v_incomplete_count integer := 0;
  v_low_score_count integer := 0;
  v_mentoring_count integer := 0;
  v_invite_pending_count integer := 0;
  v_invite_expired_count integer := 0;
  v_config_weight numeric := 0;
  v_config_detail_count integer := 0;
  v_top_scores jsonb := '[]'::jsonb;
  v_bottom_scores jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Autentikasi diperlukan';
  end if;

  select u.id, u.role, u.is_active
  into v_profile
  from public.users u
  where u.id = auth.uid();

  if v_profile.id is null or not v_profile.is_active then
    raise exception 'Sesi tidak aktif';
  end if;

  v_is_admin := v_profile.role = 'admin';
  if v_is_admin then
    v_can_assessment := true;
    v_can_leaderboard := true;
    v_can_mentoring := true;
    v_can_cashiers := true;
  else
    select
      coalesce(bool_or(rp.permission = 'assessment' and rp.enabled), false),
      coalesce(bool_or(rp.permission = 'leaderboard' and rp.enabled), false),
      coalesce(bool_or(rp.permission = 'mentoring' and rp.enabled), false),
      coalesce(bool_or(rp.permission = 'cashiers.view' and rp.enabled), false)
    into
      v_can_assessment,
      v_can_leaderboard,
      v_can_mentoring,
      v_can_cashiers
    from public.role_permission rp
    where rp.role = v_profile.role
      and rp.permission in ('assessment', 'leaderboard', 'mentoring', 'cashiers.view');
  end if;

  select p.id, p.label, p.start_date, p.end_date, p.status
  into v_period
  from public.period p
  where p.status = 'open'
  order by p.start_date desc
  limit 1;

  if v_is_admin then
    select coalesce(array_agg(b.id), '{}'::uuid[])
    into v_branch_ids
    from public.branch b
    where b.is_active = true;
  else
    select coalesce(array_agg(ub.branch_id), '{}'::uuid[])
    into v_branch_ids
    from public.user_branch ub
    where ub.user_id = v_profile.id;
  end if;
  v_has_branches := cardinality(v_branch_ids) > 0;

  if (v_is_admin or v_can_cashiers) and v_has_branches then
    select count(*)::integer
    into v_cashier_count
    from public.cashier c
    join public.outlet o on o.id = c.outlet_id
    where c.is_active = true
      and o.branch_id = any(v_branch_ids);
  end if;

  if v_period.id is not null and v_has_branches and (v_is_admin or v_can_assessment or v_can_cashiers) then
    select count(*) filter (where cpc.status = 'complete')::integer,
           count(*) filter (where cpc.status <> 'complete')::integer
    into v_complete_count, v_incomplete_count
    from public.cashier_period_completion cpc
    join public.cashier c on c.id = cpc.cashier_id
    join public.outlet o on o.id = c.outlet_id
    where cpc.period_id = v_period.id
      and o.branch_id = any(v_branch_ids);
  end if;

  if v_period.id is not null and v_has_branches and (v_is_admin or v_can_leaderboard or v_can_assessment) then
    select count(*)::integer
    into v_low_score_count
    from public.cashier_period_score cps
    join public.cashier c on c.id = cps.cashier_id
    join public.outlet o on o.id = c.outlet_id
    where cps.period_id = v_period.id
      and cps.total_score < 70
      and o.branch_id = any(v_branch_ids);

    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', ranked.cashier_id, 'name', ranked.name, 'score', ranked.total_score)
        order by ranked.total_score desc, ranked.cashier_id
      ),
      '[]'::jsonb
    )
    into v_top_scores
    from (
      select cps.cashier_id, c.name, cps.total_score
      from public.cashier_period_score cps
      join public.cashier c on c.id = cps.cashier_id
      join public.outlet o on o.id = c.outlet_id
      where cps.period_id = v_period.id
        and o.branch_id = any(v_branch_ids)
      order by cps.total_score desc, cps.cashier_id
      limit 3
    ) ranked;

    select coalesce(
      jsonb_agg(
        jsonb_build_object('id', ranked.cashier_id, 'name', ranked.name, 'score', ranked.total_score)
        order by ranked.total_score asc, ranked.cashier_id
      ),
      '[]'::jsonb
    )
    into v_bottom_scores
    from (
      select cps.cashier_id, c.name, cps.total_score
      from public.cashier_period_score cps
      join public.cashier c on c.id = cps.cashier_id
      join public.outlet o on o.id = c.outlet_id
      where cps.period_id = v_period.id
        and o.branch_id = any(v_branch_ids)
      order by cps.total_score asc, cps.cashier_id
      limit 3
    ) ranked;
  end if;

  if (v_is_admin or v_can_mentoring) and v_has_branches then
    select count(*)::integer
    into v_mentoring_count
    from public.mentoring_session ms
    join public.outlet o on o.id = ms.outlet_id
    where ms.visited_date >= (current_date - 30)
      and o.branch_id = any(v_branch_ids);
  end if;

  if v_is_admin then
    select count(*) filter (
             where i.used_at is null and i.revoked_at is null and i.expires_at > now()
           )::integer,
           count(*) filter (
             where i.used_at is null and i.revoked_at is null and i.expires_at < now()
           )::integer
    into v_invite_pending_count, v_invite_expired_count
    from public.invite i;

    if v_period.id is not null then
      select coalesce(sum(cwh.weight), 0)
      into v_config_weight
      from public.category_weight_history cwh
      where cwh.period_id = v_period.id;

      select count(dch.detail_id)::integer
      into v_config_detail_count
      from public.detail_config_history dch
      where dch.period_id = v_period.id;
    end if;
  end if;

  return jsonb_build_object(
    'period',
      case
        when v_period.id is null then null::jsonb
        else jsonb_build_object(
          'id', v_period.id,
          'label', v_period.label,
          'startDate', v_period.start_date,
          'endDate', v_period.end_date,
          'status', v_period.status
        )
      end,
    'cashierCount', v_cashier_count,
    'completeCount', case when v_period.id is null then null else v_complete_count end,
    'incompleteCount', case when v_period.id is null then null else v_incomplete_count end,
    'lowScoreCount', v_low_score_count,
    'topScores', v_top_scores,
    'bottomScores', v_bottom_scores,
    'mentoringCount', v_mentoring_count,
    'invitePendingCount', v_invite_pending_count,
    'inviteExpiredCount', v_invite_expired_count,
    'configWeight', v_config_weight,
    'configDetailCount', v_config_detail_count
  );
end;
$$;

revoke all on function public.get_dashboard_snapshot() from public, anon;
grant execute on function public.get_dashboard_snapshot() to authenticated, service_role;
