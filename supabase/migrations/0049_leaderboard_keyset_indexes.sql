-- ============================================================
-- 0049_leaderboard_keyset_indexes.sql
--
-- M5.2: support stable score/cashier cursor pagination and scoped filters.
-- ============================================================

create index if not exists leaderboard_entry_period_score_cashier_idx
  on public.leaderboard_entry (period_id, total_score desc, cashier_id asc);

create index if not exists leaderboard_entry_period_branch_score_cashier_idx
  on public.leaderboard_entry (period_id, branch_id, total_score desc, cashier_id asc);

create index if not exists leaderboard_entry_period_outlet_score_cashier_idx
  on public.leaderboard_entry (period_id, outlet_id, total_score desc, cashier_id asc);

create index if not exists cashier_period_score_period_score_cashier_idx
  on public.cashier_period_score (period_id, total_score desc, cashier_id asc);

create index if not exists cashier_cumulative_score_score_cashier_idx
  on public.cashier_cumulative_score (cumulative_score desc, cashier_id asc);
