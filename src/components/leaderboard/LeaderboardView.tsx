'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ChevronDown,
  Download,
  Lock,
  Medal,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, Skeleton, Spinner } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { BottomSheet } from '@/components/ui/Overlay';
import { cn } from '@/lib/cn';
import { appQueryKeys } from '@/lib/client/query-keys';
import { LeaderboardIndicatorScore } from '@/lib/leaderboard/indicator-scores';
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
  indicator_scores: LeaderboardIndicatorScore[];
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

function LeaderboardSkeleton() {
  return (
    <div className="space-y-2" role="status" aria-label="Memuat leaderboard">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={index} className="p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
        </Card>
      ))}
    </div>
  );
}

const scopeOptions = [
  { value: 'global', label: 'Lintas Cabang' },
  { value: 'branch', label: 'Per Cabang' },
  { value: 'outlet', label: 'Per Outlet' },
] as const;

type Scope = (typeof scopeOptions)[number]['value'];

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
  const [level, setLevel] = useState<Scope>('global');
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
  const [expandedCashierId, setExpandedCashierId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'scope' | 'filter' | null>(null);
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
        (Partial<LeaderboardResponse> & { error?: unknown }) | null;

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
  useEffect(() => {
    setExpandedCashierId(null);
  }, [requestKey]);

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
    queryFn: ({ pageParam, signal }) => fetchPage({ cursor: pageParam as string | null, signal }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    initialData: initialPage ? { pages: [initialPage], pageParams: [null] } : undefined,
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
    setExpandedCashierId(null);
  }

  const scopeLabel = scopeOptions.find((option) => option.value === level)?.label ?? 'Cakupan';
  const modeLabel = mode === 'period' ? 'Skor Periode' : 'Skor Akumulatif';
  const isDirty = level !== 'global' || mode !== 'period' || branchId !== '' || outletId !== '' || search !== '';
  const activeFilterCount =
    (branchId ? 1 : 0) + (outletId ? 1 : 0) + (search ? 1 : 0) +
    (level !== 'global' ? (branchId ? 0 : 1) : 0);

  return (
    <div className="space-y-4">
      {/* Bar kontrol ringkas */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSheet('scope')}
          aria-haspopup="dialog"
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-surface-300 bg-white px-3 text-xs font-medium text-surface-700"
        >
          {scopeLabel}
          <ChevronDown className="h-4 w-4 text-surface-400" aria-hidden="true" />
        </button>

        <div role="group" aria-label="Jenis skor" className="flex shrink-0 rounded-xl border border-surface-300 bg-white p-0.5">
          {(['period', 'cumulative'] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              aria-pressed={mode === item}
              className={cn(
                'h-9 rounded-lg px-2.5 text-xs font-medium transition-colors',
                mode === item
                  ? 'bg-primary-500 text-surface-900'
                  : 'text-surface-500'
              )}
            >
              {item === 'period' ? 'Periode' : 'Kumulatif'}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setSheet('filter')}
          aria-haspopup="dialog"
          className={cn(
            'flex h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium',
            activeFilterCount > 0
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-surface-300 bg-white text-surface-700'
          )}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          Filter
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-500 px-1 text-[11px] font-bold text-surface-900">
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            aria-label="Ekspor CSV"
            title="Ekspor CSV"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-300 bg-white text-surface-600 transition-colors hover:bg-surface-100 disabled:opacity-50"
          >
            {exporting ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={resetFilters}
              aria-label="Reset filter"
              title="Reset filter"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-300 bg-white text-surface-600 transition-colors hover:bg-surface-100"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Label mode aktif + status kunci */}
      <div className="flex min-h-5 items-center justify-between">
        <p className="text-xs text-surface-500">{modeLabel}</p>
        {mode === 'period' &&
          periods.find((period) => period.id === periodId)?.status === 'closed' && (
            <span className="flex items-center gap-1.5 text-xs text-surface-400">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Skor terkunci
            </span>
          )}
      </div>

      {loading && <LeaderboardSkeleton />}

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
        <EmptyState
          title="Belum ada data leaderboard"
          description="Ubah filter atau nantikan penilaian kasir masuk."
        />
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card
              key={`${periodId || 'cumulative'}-${row.cashier_id}`}
              className="overflow-hidden p-0 transition-colors hover:bg-surface-100"
            >
              <div className="flex items-stretch gap-3 p-3">
                <Link
                  href={withReturnTo(`/cashiers/${row.cashier_id}`, returnTo)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
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
                </Link>
                <div className="flex shrink-0 flex-col items-end justify-center gap-2">
                  <span className="text-sm font-bold text-primary-600">
                    {formatScore(row.total_score)}
                  </span>
                  {row.indicator_scores.length > 0 && (
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-surface-300 text-surface-500 transition-colors hover:border-primary-500 hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                      onClick={() =>
                        setExpandedCashierId((current) =>
                          current === row.cashier_id ? null : row.cashier_id
                        )
                      }
                      aria-expanded={expandedCashierId === row.cashier_id}
                      aria-controls={`leaderboard-indicators-${row.cashier_id}`}
                      aria-label={`${expandedCashierId === row.cashier_id ? 'Sembunyikan' : 'Lihat'} nilai indikator ${row.name}`}
                      title={
                        expandedCashierId === row.cashier_id
                          ? 'Sembunyikan nilai indikator'
                          : 'Lihat nilai indikator'
                      }
                    >
                      <ChevronDown
                        className={cn(
                          'h-4 w-4 transition-transform',
                          expandedCashierId === row.cashier_id && 'rotate-180'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </div>
              </div>
              {expandedCashierId === row.cashier_id && row.indicator_scores.length > 0 && (
                <div
                  id={`leaderboard-indicators-${row.cashier_id}`}
                  className="border-t border-surface-200 px-3 pb-3 pt-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">
                      Nilai indikator
                    </p>
                    {mode === 'cumulative' && (
                      <p className="text-[11px] text-surface-400">
                        Referensi{' '}
                        {periods.find((period) => period.id === periodId)?.label ??
                          'periode terpilih'}
                      </p>
                    )}
                  </div>
                  <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    {row.indicator_scores.map((indicator) => (
                      <div key={indicator.id} className="min-w-0">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-surface-600" title={indicator.name}>
                            {indicator.name}
                          </span>
                          <span className="shrink-0 font-semibold text-surface-900">
                            {formatScore(indicator.score)}
                          </span>
                        </div>
                        <div
                          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-200"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-primary-500 transition-[width]"
                            style={{ width: `${indicator.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
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

          {!hasMore && (
            <p className="py-3 text-center text-xs text-surface-400">Semua data telah dimuat.</p>
          )}
        </div>
      )}

      {/* Sheet pilih cakupan */}
      <BottomSheet open={sheet === 'scope'} onClose={() => setSheet(null)} title="Cakupan peringkat">
        <div className="space-y-2">
          {scopeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setLevel(option.value);
                setBranchId('');
                setOutletId('');
                setSheet(null);
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors',
                level === option.value
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-surface-200 bg-white text-surface-700'
              )}
            >
              {option.label}
              {level === option.value && (
                <span className="h-2.5 w-2.5 rounded-full bg-primary-500" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Sheet filter lanjutan */}
      <BottomSheet open={sheet === 'filter'} onClose={() => setSheet(null)} title="Filter leaderboard">
        <div className="space-y-4">
          {mode === 'period' && (
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
          )}

          {level !== 'global' && (
            <Select
              id="leaderboard-branch-filter"
              label="Cabang"
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
              label="Outlet"
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

          <Input
            id="leaderboard-search"
            label="Cari nama kasir"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Ketik nama kasir"
            maxLength={100}
          />

          <Button type="button" fullWidth onClick={() => setSheet(null)}>
            Terapkan
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}