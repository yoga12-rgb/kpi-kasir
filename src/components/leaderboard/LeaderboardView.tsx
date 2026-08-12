'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronDown, Download, Medal, RotateCcw, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { cn } from '@/lib/cn';
import { appQueryKeys } from '@/lib/client/query-keys';
import { useCurrentReturnTo } from '@/lib/client/use-current-return-to';
import { withReturnTo } from '@/lib/navigation';
import { formatScore } from '@/lib/utils';

const PAGE_SIZE = 25;

interface Row {
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

interface BranchOption {
  id: string;
  name: string;
}

interface OutletOption {
  id: string;
  name: string;
  branch_id: string;
}

interface PeriodOption {
  id: string;
  label: string;
  status: 'open' | 'closed';
}

interface LeaderboardResponse {
  rows: Row[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface InitialLeaderboardResult extends LeaderboardResponse {
  requestKey: string;
}

function getErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) {
    return 'Gagal memuat leaderboard';
  }

  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Gagal memuat leaderboard';
}

export function LeaderboardView({
  branches,
  outlets,
  periods,
  initialResult,
}: {
  branches: BranchOption[];
  outlets: OutletOption[];
  periods: PeriodOption[];
  initialResult?: InitialLeaderboardResult;
}) {
  const [level, setLevel] = useState<'global' | 'branch' | 'outlet'>('global');
  const [mode, setMode] = useState<'period' | 'cumulative'>('period');
  const [branchId, setBranchId] = useState('');
  const [outletId, setOutletId] = useState('');
  const [periodId, setPeriodId] = useState(
    () => periods.find((period) => period.status === 'open')?.id ?? periods[0]?.id ?? ''
  );
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const returnTo = useCurrentReturnTo();

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const buildParams = useCallback(
    (format: 'json' | 'csv') => {
      const params = new URLSearchParams({
        level,
        mode,
        format,
        limit: format === 'csv' ? '5000' : String(PAGE_SIZE),
      });
      if (periodId) params.set('periodId', periodId);
      if (branchId) params.set('branchId', branchId);
      if (outletId) params.set('outletId', outletId);
      if (search) params.set('search', search);
      return params;
    },
    [branchId, level, mode, outletId, periodId, search]
  );

  const fetchPage = useCallback(
    async ({ cursor, signal }: { cursor: string | null; signal: AbortSignal }) => {
      const params = buildParams('json');
      if (cursor) params.set('cursor', cursor);

      const response = await fetch(`/api/leaderboard?${params.toString()}`, {
        cache: 'no-store',
        signal,
      });
      const data = (await response.json().catch(() => null)) as
        | (Partial<LeaderboardResponse> & { error?: unknown })
        | null;

      if (!response.ok || !data || !Array.isArray(data.rows)) {
        throw new Error(getErrorMessage(data));
      }

      return {
        rows: data.rows,
        nextCursor: data.nextCursor ?? null,
        hasMore: data.hasMore ?? false,
      };
    },
    [buildParams]
  );

  const requestKey = buildParams('json').toString();
  const initialPage = useMemo<LeaderboardResponse | undefined>(() => {
    if (!initialResult || initialResult.requestKey !== requestKey) return undefined;
    return {
      rows: initialResult.rows,
      nextCursor: initialResult.nextCursor,
      hasMore: initialResult.hasMore,
    };
  }, [initialResult, requestKey]);
  const leaderboardQuery = useInfiniteQuery<LeaderboardResponse, Error>({
    queryKey: appQueryKeys.leaderboard(level, mode, periodId, branchId, outletId, search),
    queryFn: ({ pageParam, signal }) =>
      fetchPage({ cursor: pageParam as string | null, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [null] }
      : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const rows = useMemo(() => {
    const seen = new Set<string>();
    return (leaderboardQuery.data?.pages.flatMap((page) => page.rows) ?? []).filter((row) => {
      if (seen.has(row.cashier_id)) return false;
      seen.add(row.cashier_id);
      return true;
    });
  }, [leaderboardQuery.data]);
  const loading = leaderboardQuery.isPending;
  const loadingMore = leaderboardQuery.isFetchingNextPage;
  const error = leaderboardQuery.error?.message ?? exportError;
  const hasMore = leaderboardQuery.hasNextPage ?? false;

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void leaderboardQuery.fetchNextPage();
  }, [hasMore, leaderboardQuery, loading, loadingMore]);

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const response = await fetch(`/api/leaderboard?${buildParams('csv').toString()}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(getErrorMessage(data));
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'leaderboard.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (reason: unknown) {
      setExportError(reason instanceof Error ? reason.message : 'Gagal mengekspor leaderboard');
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setLevel('global');
    setMode('period');
    setBranchId('');
    setOutletId('');
    setSearchInput('');
    setSearch('');
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {(['global', 'branch', 'outlet'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setLevel(item);
              setBranchId('');
              setOutletId('');
            }}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
              level === item
                ? 'border-primary-500 bg-primary-500 text-surface-900'
                : 'border-surface-300 bg-white text-surface-600'
            )}
          >
            {item === 'global' ? 'Lintas Cabang' : item === 'branch' ? 'Per Cabang' : 'Per Outlet'}
          </button>
        ))}
      </div>

      {level === 'branch' && (
        <Select
          id="leaderboard-branch-filter"
          label="Pilih Cabang"
          value={branchId}
          onChange={(event) => {
            setBranchId(event.target.value);
            setOutletId('');
          }}
          options={[
            { value: '', label: 'Semua cabang' },
            ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
          ]}
        />
      )}

      {level === 'outlet' && (
        <Select
          id="leaderboard-outlet-branch-filter"
          label="Pilih Cabang"
          value={branchId}
          onChange={(event) => {
            setBranchId(event.target.value);
            setOutletId('');
          }}
          options={[
            { value: '', label: 'Semua cabang' },
            ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
          ]}
        />
      )}

      {level === 'outlet' && branchId && (
        <Select
          id="leaderboard-outlet-filter"
          label="Pilih Outlet"
          value={outletId}
          onChange={(event) => setOutletId(event.target.value)}
          options={[
            { value: '', label: 'Semua outlet' },
            ...outlets
              .filter((outlet) => outlet.branch_id === branchId)
              .map((outlet) => ({ value: outlet.id, label: outlet.name })),
          ]}
        />
      )}

      <Select
        id="leaderboard-period-filter"
        label="Periode"
        value={periodId}
        onChange={(event) => setPeriodId(event.target.value)}
        options={periods.map((period) => ({
          value: period.id,
          label: `${period.label} (${period.status === 'open' ? 'aktif' : 'ditutup'})`,
        }))}
      />

      <div className="grid grid-cols-2 gap-2">
        {(['period', 'cumulative'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={cn(
              'rounded-xl border px-3 py-2 text-xs font-medium transition-colors',
              mode === item
                ? 'border-primary-500 bg-primary-500 text-surface-900'
                : 'border-surface-300 bg-white text-surface-600'
            )}
          >
            {item === 'period' ? 'Skor Periode' : 'Skor Akumulatif'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            id="leaderboard-search"
            label="Cari nama kasir"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ketik nama kasir"
            maxLength={100}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={exportCsv}
          disabled={exporting}
          title="Ekspor CSV"
        >
          {exporting ? <Spinner /> : <Download className="h-4 w-4" aria-hidden="true" />}
          <span>{exporting ? 'Menyiapkan...' : 'Ekspor CSV'}</span>
        </Button>
        <Button type="button" variant="ghost" onClick={resetFilters} title="Reset filter">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Reset</span>
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {error && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-danger-600">{error}</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void leaderboardQuery.refetch()}
          >
            Coba lagi
          </Button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-surface-500">Belum ada data leaderboard.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={`${periodId || 'cumulative'}-${row.cashier_id}`}
              href={withReturnTo(`/cashiers/${row.cashier_id}`, returnTo)}
              className="block"
            >
              <Card className="flex items-center gap-3 py-3 transition-colors hover:bg-surface-100">
                <div className="relative h-[4.5rem] w-[4.5rem] shrink-0">
                  <div
                    className={cn(
                      'rank-frame',
                      row.rank === 1 && 'rank-frame-gold',
                      row.rank === 2 && 'rank-frame-silver',
                      row.rank === 3 && 'rank-frame-bronze'
                    )}
                  >
                    <CashierAvatar name={row.name} src={row.avatar_url} size={56} />
                  </div>
                  <span
                    className={cn(
                      'absolute -bottom-1 -left-1 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-surface-50 px-1.5 text-xs font-bold shadow-sm',
                      row.rank === 1 && 'bg-amber-300 text-amber-950',
                      row.rank === 2 && 'bg-slate-300 text-slate-800',
                      row.rank === 3 && 'bg-orange-400 text-orange-950',
                      row.rank > 3 && 'bg-surface-100 text-surface-500'
                    )}
                  >
                    {row.rank}
                  </span>
                  {row.rank <= 3 && (
                    <span
                      className={cn(
                        'absolute -right-2 -top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface-50 shadow-lg',
                        row.rank === 1 && 'bg-amber-300 text-amber-950',
                        row.rank === 2 && 'bg-slate-300 text-slate-800',
                        row.rank === 3 && 'bg-orange-400 text-orange-950'
                      )}
                      aria-label={`Peringkat ${row.rank}`}
                    >
                      {row.rank === 1 ? (
                        <Trophy className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Medal className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-surface-900">{row.name}</p>
                  <p className="truncate text-xs text-surface-500">
                    {row.outlet_name} - {row.branch_name}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary-600">
                  {formatScore(row.total_score)}
                </span>
              </Card>
            </Link>
          ))}

          {loadingMore && (
            <div className="flex justify-center py-3">
              <Spinner />
            </div>
          )}

          {hasMore && !loadingMore && (
            <Button type="button" variant="secondary" fullWidth onClick={() => void loadMore()}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Muat lebih banyak
            </Button>
          )}

          {!hasMore && <p className="py-3 text-center text-xs text-surface-400">Semua data telah dimuat.</p>}
        </div>
      )}
    </div>
  );
}
