'use client';

import { useCallback, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { ClientPagination } from '@/components/search/ClientPagination';
import { SearchField } from '@/components/search/SearchField';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { NavigationLink } from '@/components/ui/NavigationLink';
import { useCurrentReturnTo } from '@/lib/client/use-current-return-to';
import { withReturnTo } from '@/lib/navigation';
import { useUrlList, type PagedResult } from '@/lib/client/use-url-list';
import { formatDate, formatEmploymentDuration, getErrorMessage } from '@/lib/utils';

export interface CashierListItem {
  id: string;
  name: string;
  avatarSrc: string | null;
  isActive: boolean;
  employmentStartDate: string | null;
  outletName: string;
  branchName: string;
}

interface ApiCashier {
  id: string;
  name: string;
  avatar_url?: string | null;
  avatar_src?: string | null;
  is_active: boolean;
  employment_start_date: string | null;
  outlet?:
    | { name?: string | null; branch?: { name?: string | null } | null }
    | Array<{ name?: string | null; branch?: { name?: string | null } | null }>;
}

function normalizeCashier(cashier: ApiCashier): CashierListItem {
  const outlet = Array.isArray(cashier.outlet) ? cashier.outlet[0] : cashier.outlet;
  const branch = outlet?.branch;
  return {
    id: cashier.id,
    name: cashier.name,
    avatarSrc: cashier.avatar_src ?? null,
    isActive: cashier.is_active,
    employmentStartDate: cashier.employment_start_date,
    outletName: outlet?.name ?? '-',
    branchName: branch?.name ?? '-',
  };
}

function toPagedResult(payload: unknown): PagedResult<CashierListItem> {
  const data = (payload as { cashiers?: ApiCashier[] }).cashiers ?? [];
  const response = payload as {
    page?: number;
    limit?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
  const page = response.page ?? 1;
  const pageSize = response.pageSize ?? response.limit ?? 25;
  const total = response.total ?? data.length;
  return {
    items: data.map(normalizeCashier),
    page,
    pageSize,
    total,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

function getStatus(value: string | null, isAdmin: boolean) {
  if (!isAdmin) return 'active';
  return value === 'inactive' || value === 'all' ? value : 'active';
}

export function CashierListClient({
  initialResult,
  isAdmin,
  initialStatus,
}: {
  initialResult: PagedResult<CashierListItem>;
  isAdmin: boolean;
  initialStatus: string;
}) {
  const queryKeys = useMemo(() => (isAdmin ? ['status', 'q', 'page'] : ['q', 'page']), [isAdmin]);
  const fetchPage = useCallback(
    async (params: URLSearchParams, signal: AbortSignal) => {
      const requestParams = new URLSearchParams();
      requestParams.set('limit', String(initialResult.pageSize));
      queryKeys.forEach((key) => {
        const value = params.get(key);
        if (value) requestParams.set(key, value);
      });
      const response = await fetch(`/api/cashiers?${requestParams.toString()}`, { signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal memuat daftar kasir'));
      }
      return toPagedResult(payload);
    },
    [initialResult.pageSize, queryKeys]
  );
  const {
    result,
    draftQuery,
    setDraftQuery,
    submitSearch,
    goToPage,
    replaceParams,
    isFetching,
    error,
    retry,
  } = useUrlList({ initialResult, queryKeys, fetchPage });
  const searchParams = useSearchParams();
  const returnTo = useCurrentReturnTo();
  const status = getStatus(searchParams.get('status') ?? initialStatus, isAdmin);

  return (
    <>
      <div className="mt-4 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <SearchField
            label="Cari kasir"
            ariaLabel="Cari kasir"
            placeholder="Nama kasir"
            value={draftQuery}
            onChange={setDraftQuery}
            onSubmit={submitSearch}
          />
        </div>
        {isAdmin && (
          <label className="shrink-0 text-xs font-medium text-surface-500">
            <span className="sr-only">Filter status kasir</span>
            <select
              value={status}
              onChange={(event) => replaceParams({ status: event.target.value, page: null })}
              className="input w-auto text-xs"
              aria-label="Filter status kasir"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="all">Semua</option>
            </select>
          </label>
        )}
      </div>

      <div className="mt-2 min-h-5 text-xs text-surface-500" aria-live="polite">
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

      <div className="mt-2 space-y-2 transition-opacity duration-150" aria-busy={isFetching}>
        {result.items.map((cashier) => (
          <NavigationLink
            key={cashier.id}
            href={withReturnTo(`/cashiers/${cashier.id}`, returnTo)}
            pendingIndicator
            className="block"
          >
            <Card className="flex items-center gap-3 transition-colors hover:bg-surface-100">
              <CashierAvatar name={cashier.name} src={cashier.avatarSrc} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-surface-900">{cashier.name}</p>
                  {!cashier.isActive && <Badge variant="muted">Nonaktif</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-surface-400">
                  Mulai {formatDate(cashier.employmentStartDate)} &middot;{' '}
                  {formatEmploymentDuration(cashier.employmentStartDate)}
                </p>
                <p className="truncate text-sm text-surface-500">
                  {cashier.branchName} &middot; {cashier.outletName}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-surface-400" />
            </Card>
          </NavigationLink>
        ))}
        {result.items.length === 0 && (
          <p className="py-8 text-center text-sm text-surface-500">Belum ada kasir.</p>
        )}
      </div>

      <ClientPagination page={result.page} totalPages={result.totalPages} onPageChange={goToPage} />
    </>
  );
}
