import { encodeLeaderboardCursor } from '@/lib/leaderboard/cursor';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { createClient } from '@/lib/supabase/server';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const INITIAL_PAGE_SIZE = 25;

export interface InitialLeaderboardRow {
  cashier_id: string;
  name: string;
  avatar_url: string | null;
  outlet_id: string;
  outlet_name: string;
  branch_id: string;
  branch_name: string;
  total_score: number;
  rank: number;
}

export interface InitialLeaderboardResult {
  requestKey: string;
  rows: InitialLeaderboardRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface RawLeaderboardRow extends Omit<InitialLeaderboardRow, 'avatar_url'> {
  avatar_path: string | null;
}

function initialRequestKey(periodId: string) {
  const params = new URLSearchParams({
    level: 'global',
    mode: 'period',
    format: 'json',
    limit: String(INITIAL_PAGE_SIZE),
  });
  if (periodId) params.set('periodId', periodId);
  return params.toString();
}

/**
 * Preloads only the default, globally scoped first page. It deliberately does
 * not cache user/branch-scoped rows and remains aligned with the API's cursor
 * order so subsequent client pagination can continue safely.
 */
export async function getInitialLeaderboardResult(
  supabase: ServerClient,
  {
    branchIds,
    period,
  }: {
    branchIds: string[];
    period: { id: string; status: 'open' | 'closed' } | undefined;
  }
): Promise<InitialLeaderboardResult | null> {
  const requestKey = initialRequestKey(period?.id ?? '');
  if (!period || branchIds.length === 0) {
    return { requestKey, rows: [], nextCursor: null, hasMore: false };
  }

  let rows: RawLeaderboardRow[] = [];
  if (period.status === 'closed') {
    const { data, error } = await supabase
      .from('leaderboard_entry')
      .select(
        'cashier_id, cashier_name, avatar_path, outlet_id, outlet_name, branch_id, branch_name, total_score, rank_global'
      )
      .in('branch_id', branchIds)
      .eq('period_id', period.id)
      .order('total_score', { ascending: false })
      .order('cashier_id', { ascending: true })
      .limit(INITIAL_PAGE_SIZE + 1);
    if (error) return null;

    rows = (data ?? []).map((score, index) => ({
      cashier_id: score.cashier_id,
      name: score.cashier_name ?? score.cashier_id,
      avatar_path: score.avatar_path ?? null,
      outlet_id: score.outlet_id,
      outlet_name: score.outlet_name ?? score.outlet_id,
      branch_id: score.branch_id,
      branch_name: score.branch_name ?? score.branch_id,
      total_score: Number(score.total_score),
      rank: score.rank_global ?? index + 1,
    }));
  } else {
    const { data, error } = await supabase
      .from('cashier_period_score')
      .select(
        'cashier_id, total_score, cashier!inner(id, name, avatar_url, outlet!inner(id, branch_id, name, branch(name)))'
      )
      .eq('period_id', period.id)
      .in('cashier.outlet.branch_id', branchIds)
      .order('total_score', { ascending: false })
      .order('cashier_id', { ascending: true })
      .limit(INITIAL_PAGE_SIZE + 1);
    if (error) return null;

    rows = (data ?? []).map((score, index) => {
      const cashier = score.cashier as unknown as {
        id: string;
        name: string;
        avatar_url: string | null;
        outlet: { id: string; name: string; branch_id: string; branch: { name: string } };
      };
      return {
        cashier_id: score.cashier_id,
        name: cashier.name,
        avatar_path: cashier.avatar_url,
        outlet_id: cashier.outlet.id,
        outlet_name: cashier.outlet.name,
        branch_id: cashier.outlet.branch_id,
        branch_name: cashier.outlet.branch.name,
        total_score: Number(score.total_score),
        rank: index + 1,
      };
    });
  }

  const hasMore = rows.length > INITIAL_PAGE_SIZE;
  const pageRows = rows.slice(0, INITIAL_PAGE_SIZE);
  const lastRow = pageRows[pageRows.length - 1];
  const avatarUrls = await getCashierAvatarUrls(
    supabase,
    pageRows.map((row) => row.avatar_path)
  );

  return {
    requestKey,
    rows: pageRows.map(({ avatar_path, ...row }) => ({
      ...row,
      avatar_url: avatar_path ? (avatarUrls.get(avatar_path) ?? null) : null,
    })),
    nextCursor:
      hasMore && lastRow
        ? encodeLeaderboardCursor({
            score: lastRow.total_score,
            cashierId: lastRow.cashier_id,
            rank: pageRows.length,
          })
        : null,
    hasMore,
  };
}
