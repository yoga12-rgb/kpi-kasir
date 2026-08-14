import type {
  AssessmentCompletionStatus,
  AssessmentListItem,
  AssessmentListQuery,
  AssessmentListResponse,
} from '@/lib/assessment/list';
import { escapeIlike, getPageRange, getTotalPages } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import type { UserRole } from '@/types/database';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type AssessmentListActor = {
  id: string;
  role: UserRole;
};

export type AssessmentListOptions = {
  branches: { id: string; name: string }[];
  outlets: { id: string; name: string; branch_id: string }[];
};

export type AssessmentPeriod = {
  id: string;
  label: string;
};

export class AssessmentListError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AssessmentListError';
  }
}

function asCompletionStatus(value: string | null | undefined): AssessmentCompletionStatus {
  if (value === 'in_progress' || value === 'complete') return value;
  return 'not_started';
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function getOpenAssessmentPeriod(
  supabase: ServerClient
): Promise<AssessmentPeriod | null> {
  const { data, error } = await supabase
    .from('period')
    .select('id, label')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AssessmentListError('Gagal memuat periode penilaian', 500);
  return data;
}

export async function getAssessmentAccessibleBranchIds(
  supabase: ServerClient,
  actor: AssessmentListActor
) {
  if (actor.role === 'admin') {
    const { data, error } = await supabase.from('branch').select('id').eq('is_active', true);
    if (error) throw new AssessmentListError('Gagal memuat cakupan cabang', 500);
    return (data ?? []).map((branch) => branch.id);
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('user_branch')
    .select('branch_id')
    .eq('user_id', actor.id);
  if (assignmentError) throw new AssessmentListError('Gagal memuat cakupan cabang', 500);

  const assignedBranchIds = (assignments ?? []).map((assignment) => assignment.branch_id);
  if (assignedBranchIds.length === 0) return [];

  const { data: activeBranches, error: branchError } = await supabase
    .from('branch')
    .select('id')
    .eq('is_active', true)
    .in('id', assignedBranchIds);
  if (branchError) throw new AssessmentListError('Gagal memuat cakupan cabang', 500);

  return (activeBranches ?? []).map((branch) => branch.id);
}

export async function getAssessmentListOptions(
  supabase: ServerClient,
  branchIds: string[]
): Promise<AssessmentListOptions> {
  if (branchIds.length === 0) return { branches: [], outlets: [] };

  const [branchesResult, outletsResult] = await Promise.all([
    supabase
      .from('branch')
      .select('id, name')
      .eq('is_active', true)
      .in('id', branchIds)
      .order('name'),
    supabase
      .from('outlet')
      .select('id, name, branch_id')
      .eq('is_active', true)
      .in('branch_id', branchIds)
      .order('name'),
  ]);

  if (branchesResult.error || outletsResult.error) {
    throw new AssessmentListError('Gagal memuat pilihan filter penilaian', 500);
  }

  return {
    branches: branchesResult.data ?? [],
    outlets: outletsResult.data ?? [],
  };
}

async function validateAssessmentFilters(
  supabase: ServerClient,
  branchIds: string[],
  filters: AssessmentListQuery
) {
  if (filters.branchId && !branchIds.includes(filters.branchId)) {
    throw new AssessmentListError('Anda tidak memiliki akses ke cabang ini', 403);
  }

  if (!filters.outletId) return;

  const { data: outlet, error } = await supabase
    .from('outlet')
    .select('id, branch_id')
    .eq('id', filters.outletId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw new AssessmentListError('Gagal memeriksa outlet', 500);
  if (!outlet || !branchIds.includes(outlet.branch_id)) {
    throw new AssessmentListError('Anda tidak memiliki akses ke outlet ini', 403);
  }
  if (filters.branchId && outlet.branch_id !== filters.branchId) {
    throw new AssessmentListError('Outlet tidak berada pada cabang yang dipilih', 400);
  }
}

type CompletionRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  outlet:
    | {
        id: string;
        name: string;
        branch_id: string;
        branch: { id: string; name: string; code: string | null } | null;
      }
    | Array<{
        id: string;
        name: string;
        branch_id: string;
        branch: { id: string; name: string; code: string | null } | null;
      }>
    | null;
  cashier_period_completion:
    | {
        status: string;
        assessed_details: number;
        total_details: number;
      }
    | Array<{
        status: string;
        assessed_details: number;
        total_details: number;
      }>
    | null;
};

export async function getAssessmentList(
  supabase: ServerClient,
  {
    periodId,
    branchIds,
    filters,
  }: {
    periodId: string;
    branchIds: string[];
    filters: AssessmentListQuery;
  }
): Promise<AssessmentListResponse> {
  const emptyResult: AssessmentListResponse = {
    cashiers: [],
    page: filters.page,
    pageSize: filters.limit,
    total: 0,
    totalPages: 1,
    hasMore: false,
  };
  if (branchIds.length === 0) return emptyResult;

  await validateAssessmentFilters(supabase, branchIds, filters);
  const { from, to } = getPageRange(filters.page, filters.limit);
  let query = supabase
    .from('cashier')
    .select(
      'id, name, avatar_url, outlet!inner(id, name, branch_id, branch!inner(id, name, code)), cashier_period_completion!inner(status, assessed_details, total_details)',
      { count: 'exact' }
    )
    .eq('is_active', true)
    .eq('cashier_period_completion.period_id', periodId)
    .in('outlet.branch_id', branchIds)
    .order('name')
    .order('id')
    .range(from, to);

  if (filters.branchId) query = query.eq('outlet.branch_id', filters.branchId);
  if (filters.outletId) query = query.eq('outlet_id', filters.outletId);
  if (filters.status === 'pending') {
    query = query.in('cashier_period_completion.status', ['not_started', 'in_progress']);
  } else if (filters.status !== 'all') {
    query = query.eq('cashier_period_completion.status', filters.status);
  }
  if (filters.q) query = query.ilike('name', `%${escapeIlike(filters.q)}%`);

  const { data, count, error } = await query;
  if (error) throw new AssessmentListError('Gagal memuat daftar penilaian', 500);

  const rows = (data ?? []) as unknown as CompletionRow[];
  const cashierIds = rows.map((row) => row.id);
  const [scoresResult, avatarMap] = await Promise.all([
    cashierIds.length > 0
      ? supabase
          .from('cashier_period_score')
          .select('cashier_id, total_score')
          .eq('period_id', periodId)
          .in('cashier_id', cashierIds)
      : Promise.resolve({ data: [], error: null }),
    getCashierAvatarUrls(
      supabase,
      rows.map((row) => row.avatar_url)
    ),
  ]);
  if (scoresResult.error) throw new AssessmentListError('Gagal memuat skor penilaian', 500);

  const scoreByCashierId = new Map(
    (scoresResult.data ?? []).map((score) => [score.cashier_id, Number(score.total_score)])
  );
  const cashiers: AssessmentListItem[] = rows.flatMap((row) => {
    const outlet = firstRelation(row.outlet);
    const completion = firstRelation(row.cashier_period_completion);
    const branch = firstRelation(outlet?.branch);
    if (!outlet || !branch) return [];

    return [
      {
        id: row.id,
        name: row.name,
        avatarSrc: row.avatar_url ? (avatarMap.get(row.avatar_url) ?? null) : null,
        outletId: outlet.id,
        outletName: outlet.name,
        branchId: outlet.branch_id,
        branchName: branch.name,
        branchCode: branch.code,
        status: asCompletionStatus(completion?.status),
        assessedDetails: completion?.assessed_details ?? 0,
        totalDetails: completion?.total_details ?? 0,
        score: scoreByCashierId.get(row.id) ?? 0,
      },
    ];
  });
  const total = count ?? 0;
  const totalPages = getTotalPages(total, filters.limit);

  return {
    cashiers,
    page: filters.page,
    pageSize: filters.limit,
    total,
    totalPages,
    hasMore: filters.page < totalPages,
  };
}
