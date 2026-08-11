import type { Permission } from '@/lib/auth/permissions';
import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import type { Json, UserProfile } from '@/types/database';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export interface DashboardPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
}

export interface DashboardScore {
  id: string;
  name: string;
  score: number;
}

export interface DashboardSnapshot {
  period: DashboardPeriod | null;
  cashierCount: number | null;
  completeCount: number | null;
  incompleteCount: number | null;
  lowScoreCount: number | null;
  topScores: DashboardScore[];
  bottomScores: DashboardScore[];
  mentoringCount: number | null;
  invitePendingCount: number | null;
  inviteExpiredCount: number | null;
  configWeight: number;
  configDetailCount: number;
}

export interface DashboardSnapshotResult {
  snapshot: DashboardSnapshot;
  errors: string[];
  source: 'rpc' | 'fallback';
}

const emptyCount = { count: 0, error: null };

function getDashboardNowIso() {
  return new Date().toISOString();
}

function getThirtyDaysAgoIso() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function asScoreRows(value: unknown): DashboardScore[] | null {
  if (!Array.isArray(value)) return null;
  const rows: DashboardScore[] = [];
  for (const item of value) {
    const row = asRecord(item);
    const id = typeof row?.id === 'string' ? row.id : null;
    const name = typeof row?.name === 'string' ? row.name : null;
    const score = asNumber(row?.score);
    if (!id || !name || score === null) return null;
    rows.push({ id, name, score });
  }
  return rows;
}

function asPeriod(value: unknown): DashboardPeriod | null | undefined {
  if (value === null) return null;
  const row = asRecord(value);
  if (!row) return undefined;
  const id = typeof row.id === 'string' ? row.id : null;
  const label = typeof row.label === 'string' ? row.label : null;
  const startDate = typeof row.startDate === 'string' ? row.startDate : null;
  const endDate = typeof row.endDate === 'string' ? row.endDate : null;
  const status = row.status === 'open' || row.status === 'closed' ? row.status : null;
  if (!id || !label || !startDate || !endDate || !status) return undefined;
  return { id, label, startDate, endDate, status };
}

function asSnapshot(value: Json): DashboardSnapshot | null {
  const row = asRecord(value);
  if (!row) return null;

  const period = asPeriod(row.period);
  const topScores = asScoreRows(row.topScores);
  const bottomScores = asScoreRows(row.bottomScores);
  const cashierCount = asNumber(row.cashierCount);
  const completeCount = asNumber(row.completeCount);
  const incompleteCount = asNumber(row.incompleteCount);
  const lowScoreCount = asNumber(row.lowScoreCount);
  const mentoringCount = asNumber(row.mentoringCount);
  const invitePendingCount = asNumber(row.invitePendingCount);
  const inviteExpiredCount = asNumber(row.inviteExpiredCount);
  const configWeight = asNumber(row.configWeight);
  const configDetailCount = asNumber(row.configDetailCount);

  if (
    period === undefined ||
    topScores === null ||
    bottomScores === null ||
    cashierCount === null ||
    lowScoreCount === null ||
    mentoringCount === null ||
    invitePendingCount === null ||
    inviteExpiredCount === null ||
    configWeight === null ||
    configDetailCount === null
  ) {
    return null;
  }

  return {
    period,
    cashierCount,
    completeCount,
    incompleteCount,
    lowScoreCount,
    topScores,
    bottomScores,
    mentoringCount,
    invitePendingCount,
    inviteExpiredCount,
    configWeight,
    configDetailCount,
  };
}

function getRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function toScoreRows(rows: unknown): DashboardScore[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as {
      cashier_id?: string;
      total_score?: number;
      cashier?: unknown;
    };
    const cashier = getRelation(item.cashier as { id?: string; name?: string } | { id?: string; name?: string }[]);
    if (!item.cashier_id || !cashier?.name) return [];
    return [{ id: item.cashier_id, name: cashier.name, score: Number(item.total_score ?? 0) }];
  });
}

async function getFallbackSnapshot(
  supabase: ServerClient,
  profile: UserProfile,
  permissions: Permission[]
): Promise<DashboardSnapshotResult> {
  const isAdmin = profile.role === 'admin';
  const canAssessment = hasPermission(permissions, 'assessment');
  const canLeaderboard = hasPermission(permissions, 'leaderboard');
  const canMentoring = hasPermission(permissions, 'mentoring');
  const canCashiers = hasPermission(permissions, 'cashiers.view');
  const errors: string[] = [];

  const currentPeriodPromise = supabase
    .from('period')
    .select('id, label, start_date, end_date, status')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const branchPromise = isAdmin
    ? supabase.from('branch').select('id').eq('is_active', true)
    : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id);
  const [currentPeriodResult, branchResult] = await Promise.all([currentPeriodPromise, branchPromise]);

  if (currentPeriodResult.error) errors.push('periode aktif');
  if (branchResult.error) errors.push(isAdmin ? 'cabang' : 'akses cabang');

  const currentPeriod = currentPeriodResult.data;
  const branchIds = isAdmin
    ? ((branchResult.data ?? []) as { id: string }[]).map((branch) => branch.id)
    : ((branchResult.data ?? []) as { branch_id: string }[]).map((branch) => branch.branch_id);
  const hasBranches = branchIds.length > 0;
  const scoreQueryEnabled = currentPeriod && hasBranches && (isAdmin || canLeaderboard || canAssessment);
  const createScoreQuery = () =>
    supabase
      .from('cashier_period_score')
      .select('cashier_id, total_score, cashier!inner(id, name, outlet!inner(branch_id))')
      .eq('period_id', currentPeriod?.id ?? '')
      .in('cashier.outlet.branch_id', branchIds);

  const results = await Promise.all([
    (isAdmin || canCashiers) && hasBranches
      ? supabase
          .from('cashier')
          .select('id, outlet!inner(branch_id)', { count: 'exact', head: true })
          .eq('is_active', true)
          .in('outlet.branch_id', branchIds)
      : Promise.resolve(emptyCount),
    currentPeriod && hasBranches && (isAdmin || canAssessment || canCashiers)
      ? supabase
          .from('cashier_period_completion')
          .select('id, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
          .eq('period_id', currentPeriod.id)
          .eq('status', 'complete')
          .in('cashier.outlet.branch_id', branchIds)
      : Promise.resolve(emptyCount),
    currentPeriod && hasBranches && (isAdmin || canAssessment || canCashiers)
      ? supabase
          .from('cashier_period_completion')
          .select('id, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
          .eq('period_id', currentPeriod.id)
          .neq('status', 'complete')
          .in('cashier.outlet.branch_id', branchIds)
      : Promise.resolve(emptyCount),
    scoreQueryEnabled
      ? supabase
          .from('cashier_period_score')
          .select('id, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
          .eq('period_id', currentPeriod.id)
          .lt('total_score', 70)
          .in('cashier.outlet.branch_id', branchIds)
      : Promise.resolve(emptyCount),
    scoreQueryEnabled
      ? createScoreQuery().order('total_score', { ascending: false }).order('cashier_id').limit(3)
      : Promise.resolve({ data: [], error: null }),
    scoreQueryEnabled
      ? createScoreQuery().order('total_score', { ascending: true }).order('cashier_id').limit(3)
      : Promise.resolve({ data: [], error: null }),
    (isAdmin || canMentoring) && hasBranches
      ? supabase
          .from('mentoring_session')
          .select('id, outlet!inner(branch_id)', { count: 'exact', head: true })
          .gte('visited_date', getThirtyDaysAgoIso())
          .in('outlet.branch_id', branchIds)
      : Promise.resolve(emptyCount),
    isAdmin
      ? supabase
          .from('invite')
          .select('id', { count: 'exact', head: true })
          .is('used_at', null)
          .is('revoked_at', null)
          .gt('expires_at', getDashboardNowIso())
      : Promise.resolve(emptyCount),
    isAdmin
      ? supabase
          .from('invite')
          .select('id', { count: 'exact', head: true })
          .is('used_at', null)
          .is('revoked_at', null)
          .lt('expires_at', getDashboardNowIso())
      : Promise.resolve(emptyCount),
    currentPeriod && isAdmin
      ? supabase.from('category_weight_history').select('weight').eq('period_id', currentPeriod.id)
      : Promise.resolve({ data: [], error: null }),
    currentPeriod && isAdmin
      ? supabase
          .from('detail_config_history')
          .select('detail_id', { count: 'exact', head: true })
          .eq('period_id', currentPeriod.id)
      : Promise.resolve(emptyCount),
  ]);

  const [
    cashierCountResult,
    completionCompleteResult,
    completionIncompleteResult,
    lowScoreResult,
    topScoreResult,
    bottomScoreResult,
    mentoringResult,
    invitePendingResult,
    inviteExpiredResult,
    configWeightResult,
    configDetailResult,
  ] = results;

  if (cashierCountResult.error) errors.push('kasir aktif');
  if (completionCompleteResult.error || completionIncompleteResult.error) errors.push('kelengkapan penilaian');
  if (lowScoreResult.error || topScoreResult.error || bottomScoreResult.error) errors.push('skor periode');
  if (mentoringResult.error) errors.push('pendampingan');
  if (invitePendingResult.error || inviteExpiredResult.error) errors.push('undangan');
  if (configWeightResult.error || configDetailResult.error) errors.push('konfigurasi periode');

  const configWeight = (configWeightResult.data ?? []).reduce(
    (total, row) => total + Number(row.weight),
    0
  );

  return {
    source: 'fallback',
    errors,
    snapshot: {
      period: currentPeriod
        ? {
            id: currentPeriod.id,
            label: currentPeriod.label,
            startDate: currentPeriod.start_date,
            endDate: currentPeriod.end_date,
            status: currentPeriod.status,
          }
        : null,
      cashierCount: cashierCountResult.error ? null : cashierCountResult.count ?? 0,
      completeCount: currentPeriod
        ? completionCompleteResult.error
          ? null
          : completionCompleteResult.count ?? 0
        : null,
      incompleteCount: currentPeriod
        ? completionIncompleteResult.error
          ? null
          : completionIncompleteResult.count ?? 0
        : null,
      lowScoreCount: lowScoreResult.error ? null : lowScoreResult.count ?? 0,
      topScores: toScoreRows(topScoreResult.data),
      bottomScores: toScoreRows(bottomScoreResult.data),
      mentoringCount: mentoringResult.error ? null : mentoringResult.count ?? 0,
      invitePendingCount: invitePendingResult.error ? null : invitePendingResult.count ?? 0,
      inviteExpiredCount: inviteExpiredResult.error ? null : inviteExpiredResult.count ?? 0,
      configWeight,
      configDetailCount: configDetailResult.error ? 0 : configDetailResult.count ?? 0,
    },
  };
}

export async function getDashboardSnapshot(
  supabase: ServerClient,
  profile: UserProfile,
  permissions: Permission[]
): Promise<DashboardSnapshotResult> {
  const { data, error } = await supabase.rpc('get_dashboard_snapshot');
  const snapshot = !error && data ? asSnapshot(data) : null;
  if (snapshot) return { snapshot, errors: [], source: 'rpc' };

  if (process.env.NODE_ENV !== 'production') {
    console.warn('[dashboard] snapshot RPC unavailable, using query fallback', error?.code ?? 'invalid-result');
  }
  return getFallbackSnapshot(supabase, profile, permissions);
}
