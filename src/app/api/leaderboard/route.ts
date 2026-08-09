import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';
import { decodeLeaderboardCursor, encodeLeaderboardCursor } from '@/lib/leaderboard/cursor';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface LeaderboardRow {
  cashier_id: string;
  name: string;
  avatar_path: string | null;
  outlet_id: string;
  outlet_name: string;
  branch_id: string;
  branch_name: string;
  total_score: number;
  rank: number;
}

const optionalUuid = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().uuid().optional()
);

const optionalSearch = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(100).optional()
);

const leaderboardQuerySchema = z.object({
  level: z.enum(['global', 'branch', 'outlet']).default('global'),
  mode: z.enum(['period', 'cumulative']).default('period'),
  format: z.enum(['json', 'csv']).default('json'),
  limit: z.coerce.number().int().min(1).max(5000).default(25),
  cursor: z.string().optional(),
  search: optionalSearch,
  branchId: optionalUuid,
  outletId: optionalUuid,
  periodId: optionalUuid,
});

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function csvCell(value: string | number | null | undefined) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function csvResponse(rows: LeaderboardRow[], label: string | null, mode: string) {
  const header = ['Peringkat', 'Nama', 'Outlet', 'Cabang', 'Skor'];
  const body = rows.map((row) =>
    [row.rank, row.name, row.outlet_name, row.branch_name, row.total_score]
      .map(csvCell)
      .join(',')
  );
  const csv = [header.map(csvCell).join(','), ...body].join('\r\n');
  const safeLabel = (label ?? mode).replace(/[^a-zA-Z0-9_-]+/g, '-');

  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="leaderboard-${safeLabel}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

async function handleGET(request: Request) {
  const profile = await requirePermission('leaderboard');
  const { searchParams } = new URL(request.url);
  const parsedQuery = leaderboardQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Parameter leaderboard tidak valid' }, { status: 400 });
  }

  const {
    level,
    mode,
    format,
    limit: requestedLimit,
    cursor: cursorValue,
    search,
    branchId,
    outletId,
    periodId,
  } = parsedQuery.data;

  if (format === 'json' && requestedLimit > 100) {
    return NextResponse.json({ error: 'Limit JSON maksimal 100' }, { status: 400 });
  }
  if (level === 'global' && (branchId || outletId)) {
    return NextResponse.json(
      { error: 'Filter cabang atau outlet hanya dapat dipakai pada level yang sesuai' },
      { status: 400 }
    );
  }
  if (level === 'branch' && outletId) {
    return NextResponse.json(
      { error: 'Filter outlet hanya dapat dipakai pada level outlet' },
      { status: 400 }
    );
  }

  const cursor = cursorValue ? decodeLeaderboardCursor(cursorValue) : null;
  if (cursorValue && !cursor) {
    return NextResponse.json({ error: 'Cursor leaderboard tidak valid' }, { status: 400 });
  }

  const limit = requestedLimit;
  const supabase = await createClient();

  let selectedPeriodId = periodId;
  let selectedPeriodStatus: 'open' | 'closed' | null = null;
  let selectedPeriodLabel: string | null = null;
  if (selectedPeriodId) {
    const { data: selectedPeriod } = await supabase
      .from('period')
      .select('id, label, status')
      .eq('id', selectedPeriodId)
      .maybeSingle();
    if (!selectedPeriod) {
      return NextResponse.json({ error: 'Periode tidak ditemukan' }, { status: 404 });
    }
    selectedPeriodStatus = selectedPeriod.status;
    selectedPeriodLabel = selectedPeriod.label;
  } else {
    const { data: currentPeriod } = await supabase
      .from('period')
      .select('id, label, status')
      .eq('status', 'open')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    selectedPeriodId = currentPeriod?.id;
    selectedPeriodStatus = currentPeriod?.status ?? null;
    selectedPeriodLabel = currentPeriod?.label ?? null;
  }

  let accessibleBranchIds: string[] = [];
  if (profile.role === 'admin') {
    const { data } = await supabase.from('branch').select('id').eq('is_active', true);
    accessibleBranchIds = (data ?? []).map((branch) => branch.id);
  } else {
    const { data } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    accessibleBranchIds = (data ?? []).map((branch) => branch.branch_id);
  }

  if (branchId && !accessibleBranchIds.includes(branchId)) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  if (outletId) {
    const { data: outlet } = await supabase
      .from('outlet')
      .select('id, branch_id')
      .eq('id', outletId)
      .maybeSingle();
    if (!outlet) {
      return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 404 });
    }
    if (!accessibleBranchIds.includes(outlet.branch_id)) {
      return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
    }
    if (branchId && outlet.branch_id !== branchId) {
      return NextResponse.json(
        { error: 'Outlet tidak berada pada cabang yang dipilih' },
        { status: 400 }
      );
    }
  }

  if (accessibleBranchIds.length === 0) {
    return format === 'csv'
      ? csvResponse([], selectedPeriodLabel, mode)
      : NextResponse.json({ rows: [], nextCursor: null, hasMore: false });
  }

  const searchPattern = search ? `%${escapeIlike(search)}%` : null;
  const rankOffset = cursor?.rank ?? 0;
  let rows: LeaderboardRow[] = [];

  if (mode === 'period' && selectedPeriodId && selectedPeriodStatus === 'closed') {
    let query = supabase
      .from('leaderboard_entry')
      .select(
        'cashier_id, cashier_name, avatar_path, outlet_id, outlet_name, branch_id, branch_name, total_score, rank_global, rank_branch, rank_outlet'
      )
      .in('branch_id', accessibleBranchIds)
      .eq('period_id', selectedPeriodId);

    if (level === 'branch' && branchId) query = query.eq('branch_id', branchId);
    if (level === 'outlet' && outletId) query = query.eq('outlet_id', outletId);
    if (searchPattern) query = query.ilike('cashier_name', searchPattern);
    if (cursor) {
      query = query.or(
        `total_score.lt.${cursor.score},and(total_score.eq.${cursor.score},cashier_id.gt.${cursor.cashierId})`
      );
    }

    const { data, error } = await query
      .order('total_score', { ascending: false })
      .order('cashier_id', { ascending: true })
      .limit(limit + 1);
    if (error) {
      return NextResponse.json({ error: 'Gagal memuat leaderboard' }, { status: 500 });
    }

    rows = (data ?? []).map((score, index) => ({
      cashier_id: score.cashier_id,
      name: score.cashier_name ?? score.cashier_id,
      avatar_path: score.avatar_path ?? null,
      outlet_id: score.outlet_id,
      outlet_name: score.outlet_name ?? score.outlet_id,
      branch_id: score.branch_id,
      branch_name: score.branch_name ?? score.branch_id,
      total_score: Number(score.total_score),
      rank:
        level === 'global'
          ? (score.rank_global ?? rankOffset + index + 1)
          : level === 'branch'
            ? (score.rank_branch ?? rankOffset + index + 1)
            : (score.rank_outlet ?? rankOffset + index + 1),
    }));
  } else if (mode === 'period' && selectedPeriodId && selectedPeriodStatus === 'open') {
    let query = supabase
      .from('cashier_period_score')
      .select(
        'cashier_id, total_score, cashier!inner(id, name, avatar_url, outlet!inner(id, branch_id, name, branch(name)))'
      )
      .eq('period_id', selectedPeriodId)
      .in('cashier.outlet.branch_id', accessibleBranchIds);

    if (level === 'branch' && branchId) query = query.eq('cashier.outlet.branch_id', branchId);
    if (level === 'outlet' && outletId) query = query.eq('cashier.outlet_id', outletId);
    if (searchPattern) query = query.ilike('cashier.name', searchPattern);
    if (cursor) {
      query = query.or(
        `total_score.lt.${cursor.score},and(total_score.eq.${cursor.score},cashier_id.gt.${cursor.cashierId})`
      );
    }

    const { data, error } = await query
      .order('total_score', { ascending: false })
      .order('cashier_id', { ascending: true })
      .limit(limit + 1);
    if (error) {
      return NextResponse.json({ error: 'Gagal memuat leaderboard' }, { status: 500 });
    }

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
        rank: rankOffset + index + 1,
      };
    });
  } else if (mode === 'cumulative') {
    let query = supabase
      .from('cashier_cumulative_score')
      .select(
        'cashier_id, cumulative_score, cashier!inner(id, name, avatar_url, outlet!inner(id, branch_id, name, branch(name)))'
      )
      .in('cashier.outlet.branch_id', accessibleBranchIds);

    if (level === 'branch' && branchId) query = query.eq('cashier.outlet.branch_id', branchId);
    if (level === 'outlet' && outletId) query = query.eq('cashier.outlet_id', outletId);
    if (searchPattern) query = query.ilike('cashier.name', searchPattern);
    if (cursor) {
      query = query.or(
        `cumulative_score.lt.${cursor.score},and(cumulative_score.eq.${cursor.score},cashier_id.gt.${cursor.cashierId})`
      );
    }

    const { data, error } = await query
      .order('cumulative_score', { ascending: false })
      .order('cashier_id', { ascending: true })
      .limit(limit + 1);
    if (error) {
      return NextResponse.json({ error: 'Gagal memuat leaderboard' }, { status: 500 });
    }

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
        total_score: Number(score.cumulative_score),
        rank: rankOffset + index + 1,
      };
    });
  }

  const hasMore = rows.length > limit;
  const pageRows = rows.slice(0, limit);
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeLeaderboardCursor({
          score: lastRow.total_score,
          cashierId: lastRow.cashier_id,
          rank: rankOffset + pageRows.length,
        })
      : null;

  if (format === 'csv') {
    return csvResponse(pageRows, selectedPeriodLabel, mode);
  }

  const avatarUrls = await getCashierAvatarUrls(
    supabase,
    pageRows.map((row) => row.avatar_path)
  );
  const responseRows = pageRows.map(({ avatar_path, ...row }) => ({
    ...row,
    avatar_url: avatar_path ? (avatarUrls.get(avatar_path) ?? null) : null,
  }));

  return NextResponse.json({ rows: responseRows, nextCursor, hasMore });
}

export const GET = withApiRoute(handleGET);
