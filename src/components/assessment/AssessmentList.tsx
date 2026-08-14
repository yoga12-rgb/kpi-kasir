'use client';

import { ChevronRight, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { ClientPagination } from '@/components/search/ClientPagination';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { BottomSheet } from '@/components/ui/Overlay';
import { NavigationLink } from '@/components/ui/NavigationLink';
import type {
  AssessmentCompletionStatus,
  AssessmentListItem,
  AssessmentListResponse,
  AssessmentListStatus,
} from '@/lib/assessment/list';
import { appQueryKeys } from '@/lib/client/query-keys';
import { type PagedResult, useUrlList } from '@/lib/client/use-url-list';
import { cn } from '@/lib/cn';
import { withReturnTo } from '@/lib/navigation';
import { formatScore, getErrorMessage } from '@/lib/utils';

interface BranchOption {
  id: string;
  name: string;
}

interface OutletOption {
  id: string;
  name: string;
  branch_id: string;
}

interface FilterState {
  branchId: string;
  outletId: string;
  status: AssessmentListStatus;
}

const defaultFilters: FilterState = {
  branchId: '',
  outletId: '',
  status: 'pending',
};

const statusOptions: { value: AssessmentListStatus; label: string }[] = [
  { value: 'pending', label: 'Perlu dinilai' },
  { value: 'not_started', label: 'Belum mulai' },
  { value: 'in_progress', label: 'Berjalan' },
  { value: 'complete', label: 'Selesai' },
  { value: 'all', label: 'Semua status' },
];

function getStatus(value: string | null): AssessmentListStatus {
  return statusOptions.some((option) => option.value === value)
    ? (value as AssessmentListStatus)
    : 'pending';
}

function getFilters(queryString: string): FilterState {
  const params = new URLSearchParams(queryString);
  return {
    branchId: params.get('branchId') ?? '',
    outletId: params.get('outletId') ?? '',
    status: getStatus(params.get('status')),
  };
}

function toPagedResult(payload: unknown): PagedResult<AssessmentListItem> {
  const response = payload as Partial<AssessmentListResponse>;
  const cashiers = Array.isArray(response.cashiers) ? response.cashiers : [];
  const page = response.page ?? 1;
  const pageSize = response.pageSize ?? 25;
  const total = response.total ?? cashiers.length;

  return {
    items: cashiers,
    page,
    pageSize,
    total,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

function completionLabel(status: AssessmentCompletionStatus, assessed: number, total: number) {
  if (status === 'complete') return 'Selesai';
  if (status === 'in_progress') return `Berjalan ${assessed}/${total}`;
  return 'Belum mulai';
}

function completionVariant(status: AssessmentCompletionStatus) {
  if (status === 'complete') return 'success';
  if (status === 'in_progress') return 'warning';
  return 'muted';
}

export function AssessmentList({
  initialResult,
  branches,
  outlets,
}: {
  initialResult: PagedResult<AssessmentListItem>;
  branches: BranchOption[];
  outlets: OutletOption[];
}) {
  const pathname = usePathname();
  const queryKeys = useMemo(() => ['branchId', 'outletId', 'status', 'q', 'page'], []);
  const queryKeyFactory = useCallback(
    (_pathname: string, filters: readonly string[]) => appQueryKeys.assessmentList(filters),
    []
  );
  const fetchPage = useCallback(
    async (params: URLSearchParams, signal: AbortSignal) => {
      const requestParams = new URLSearchParams();
      requestParams.set('limit', String(initialResult.pageSize));
      queryKeys.forEach((key) => {
        const value = params.get(key);
        if (value) requestParams.set(key, value);
      });

      const response = await fetch(`/api/assessments/cashiers?${requestParams.toString()}`, {
        signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal memuat daftar penilaian'));
      }
      return toPagedResult(payload);
    },
    [initialResult.pageSize, queryKeys]
  );
  const {
    result,
    draftQuery,
    setDraftQuery,
    replaceParams,
    isFetching,
    error,
    retry,
    currentQueryString,
  } = useUrlList({
    initialResult,
    queryKeys,
    fetchPage,
    queryKeyFactory,
  });
  const returnTo = useMemo(() => {
    const params = new URLSearchParams(currentQueryString);
    params.delete('returnTo');
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [currentQueryString, pathname]);
  const filters = useMemo(() => getFilters(currentQueryString), [currentQueryString]);
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => filters);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) setDraftFilters(filters);
  }, [filters, sheetOpen]);

  useEffect(() => {
    const currentSearch = new URLSearchParams(currentQueryString).get('q') ?? '';
    const nextSearch = draftQuery.trim();
    if (currentSearch === nextSearch) return;

    const timeout = window.setTimeout(() => {
      replaceParams({ q: nextSearch || null, page: null });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [currentQueryString, draftQuery, replaceParams]);

  const visibleOutlets = useMemo(
    () =>
      draftFilters.branchId
        ? outlets.filter((outlet) => outlet.branch_id === draftFilters.branchId)
        : outlets,
    [draftFilters.branchId, outlets]
  );
  const appliedSearch = useMemo(
    () => new URLSearchParams(currentQueryString).get('q')?.trim() ?? '',
    [currentQueryString]
  );

  const activeFilterCount =
    (filters.branchId ? 1 : 0) +
    (filters.outletId ? 1 : 0) +
    (filters.status !== 'pending' ? 1 : 0) +
    (appliedSearch ? 1 : 0);

  function applyFilters() {
    replaceParams({
      branchId: draftFilters.branchId || null,
      outletId: draftFilters.outletId || null,
      status: draftFilters.status === 'pending' ? null : draftFilters.status,
      page: null,
    });
    setSheetOpen(false);
  }

  function resetFilters() {
    replaceParams({
      branchId: null,
      outletId: null,
      status: null,
      q: null,
      page: null,
    });
    setDraftFilters(defaultFilters);
  }

  function submitSearch() {
    replaceParams({ q: draftQuery.trim() || null, page: null });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id="assessment-search"
            label="Cari kasir"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitSearch();
              }
            }}
            placeholder="Nama kasir"
            maxLength={100}
          />
        </div>
        <button
          type="button"
          onClick={submitSearch}
          className="btn btn-secondary h-10 w-10 shrink-0 px-0"
          aria-label="Cari kasir"
          title="Cari kasir"
        >
          <Search className="mx-auto h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDraftFilters(filters);
            setSheetOpen(true);
          }}
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
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            aria-label="Reset filter"
            title="Reset filter"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-300 bg-white text-surface-600 transition-colors hover:bg-surface-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="min-h-5 text-xs text-surface-500" aria-live="polite">
        {isFetching && 'Memuat hasil terbaru...'}
        {error && (
          <span className="text-danger-600">
            {error}{' '}
            <button type="button" className="font-semibold underline" onClick={retry}>
              Coba lagi
            </button>
          </span>
        )}
      </div>

      <div className="space-y-2 transition-opacity duration-150" aria-busy={isFetching}>
        {result.items.map((cashier) => (
          <NavigationLink
            key={cashier.id}
            href={withReturnTo(`/assessment/${cashier.id}`, returnTo)}
            pendingIndicator
            className="block"
          >
            <Card className="flex items-center gap-3 transition-colors hover:bg-surface-100">
              <CashierAvatar name={cashier.name} src={cashier.avatarSrc} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-surface-900">{cashier.name}</p>
                  {cashier.branchCode && (
                    <span className="rounded-md bg-surface-200/80 px-1.5 py-0.5 text-xs font-semibold text-surface-700">
                      {cashier.branchCode}
                    </span>
                  )}
                </div>
                <p className="truncate text-sm text-surface-500">
                  {cashier.branchName} &middot; {cashier.outletName}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <Badge variant={completionVariant(cashier.status)}>
                    {completionLabel(cashier.status, cashier.assessedDetails, cashier.totalDetails)}
                  </Badge>
                  <p className="mt-1 text-xs text-surface-500">Skor {formatScore(cashier.score)}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
              </div>
            </Card>
          </NavigationLink>
        ))}
        {result.items.length === 0 && !error && (
          <EmptyState
            title="Tidak ada kasir"
            description="Tidak ada kasir yang sesuai dengan filter penilaian."
          />
        )}
      </div>

      <ClientPagination
        page={result.page}
        totalPages={result.totalPages}
        onPageChange={(page) => replaceParams({ page: page > 1 ? String(page) : null })}
      />

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter penilaian">
        <div className="space-y-4">
          <Select
            id="assessment-status-filter"
            label="Status"
            value={draftFilters.status}
            onChange={(event) =>
              setDraftFilters({ ...draftFilters, status: getStatus(event.target.value) })
            }
            options={statusOptions}
          />
          <Select
            id="assessment-branch-filter"
            label="Cabang"
            value={draftFilters.branchId}
            onChange={(event) =>
              setDraftFilters({ ...draftFilters, branchId: event.target.value, outletId: '' })
            }
            options={[
              { value: '', label: 'Semua cabang' },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />
          <Select
            id="assessment-outlet-filter"
            label="Outlet"
            value={draftFilters.outletId}
            onChange={(event) => setDraftFilters({ ...draftFilters, outletId: event.target.value })}
            options={[
              { value: '', label: 'Semua outlet' },
              ...visibleOutlets.map((outlet) => ({ value: outlet.id, label: outlet.name })),
            ]}
          />
          <Button type="button" fullWidth onClick={applyFilters}>
            Terapkan
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
