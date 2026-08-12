'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ClientPagination } from '@/components/search/ClientPagination';
import { SearchField } from '@/components/search/SearchField';
import { Card } from '@/components/ui/Card';
import { useUrlList, type PagedResult } from '@/lib/client/use-url-list';
import { useCurrentReturnTo } from '@/lib/client/use-current-return-to';
import { withReturnTo } from '@/lib/navigation';
import { formatEmploymentDuration, getErrorMessage } from '@/lib/utils';

const QUERY_KEYS = ['q', 'page'];

export interface OutletCashierListItem {
  id: string;
  name: string;
  employmentStartDate: string;
  isActive: boolean;
}

interface ApiCashier {
  id: string;
  name: string;
  employment_start_date: string;
  is_active: boolean;
}

function toPagedResult(payload: unknown): PagedResult<OutletCashierListItem> {
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
    items: data.map((cashier) => ({
      id: cashier.id,
      name: cashier.name,
      employmentStartDate: cashier.employment_start_date,
      isActive: cashier.is_active,
    })),
    page,
    pageSize,
    total,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function OutletCashierListClient({
  outletId,
  initialResult,
}: {
  outletId: string;
  initialResult: PagedResult<OutletCashierListItem>;
}) {
  const fetchPage = useCallback(
    async (params: URLSearchParams, signal: AbortSignal) => {
      const requestParams = new URLSearchParams(params.toString());
      requestParams.set('outletId', outletId);
      requestParams.set('limit', String(initialResult.pageSize));
      const response = await fetch(`/api/cashiers?${requestParams.toString()}`, { signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal memuat daftar kasir'));
      }
      return toPagedResult(payload);
    },
    [initialResult.pageSize, outletId]
  );
  const { result, draftQuery, setDraftQuery, submitSearch, goToPage, isPending, error, retry } =
    useUrlList({ initialResult, queryKeys: QUERY_KEYS, fetchPage });
  const returnTo = useCurrentReturnTo();

  return (
    <>
      <div className="mb-3">
        <SearchField
          label="Cari kasir"
          ariaLabel="Cari kasir"
          placeholder="Nama kasir"
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={submitSearch}
        />
      </div>
      <div className="mb-2 min-h-5 text-xs text-surface-500" aria-live="polite">
        {isPending && 'Memuat hasil terbaru...'}
        {error && (
          <span className="text-danger-600">
            {error}{' '}
            <button type="button" className="font-semibold underline" onClick={retry}>
              Coba lagi
            </button>
          </span>
        )}
      </div>
      <div className="space-y-2" aria-busy={isPending}>
        {result.items.map((cashier) => (
          <Link
            key={cashier.id}
            href={withReturnTo(`/cashiers/${cashier.id}`, returnTo)}
            className="block"
          >
            <Card className="flex items-center justify-between transition-colors hover:bg-surface-100">
              <div>
                <p className="font-medium text-surface-900">{cashier.name}</p>
                <p className="text-xs text-surface-500">
                  Masa kerja {formatEmploymentDuration(cashier.employmentStartDate)}
                </p>
              </div>
              <span className="text-surface-400" aria-hidden="true">
                &rarr;
              </span>
            </Card>
          </Link>
        ))}
        {result.items.length === 0 && (
          <p className="text-sm text-surface-500">Belum ada kasir aktif.</p>
        )}
      </div>
      <ClientPagination page={result.page} totalPages={result.totalPages} onPageChange={goToPage} />
    </>
  );
}
