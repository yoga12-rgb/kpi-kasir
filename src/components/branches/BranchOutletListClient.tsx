'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ClientPagination } from '@/components/search/ClientPagination';
import { SearchField } from '@/components/search/SearchField';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useUrlList, type PagedResult } from '@/lib/client/use-url-list';
import { useCurrentReturnTo } from '@/lib/client/use-current-return-to';
import { withReturnTo } from '@/lib/navigation';
import { getErrorMessage } from '@/lib/utils';

const QUERY_KEYS = ['q', 'page'];

export interface BranchOutletListItem {
  id: string;
  name: string;
  isActive: boolean;
  cashierCount: number;
}

interface ApiOutlet {
  id: string;
  name: string;
  is_active: boolean;
  cashier?: Array<{ count?: number }>;
}

function toPagedResult(payload: unknown): PagedResult<BranchOutletListItem> {
  const data = (payload as { outlets?: ApiOutlet[] }).outlets ?? [];
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
    items: data.map((outlet) => ({
      id: outlet.id,
      name: outlet.name,
      isActive: outlet.is_active,
      cashierCount: outlet.cashier?.[0]?.count ?? 0,
    })),
    page,
    pageSize,
    total,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function BranchOutletListClient({
  branchId,
  initialResult,
}: {
  branchId: string;
  initialResult: PagedResult<BranchOutletListItem>;
}) {
  const fetchPage = useCallback(
    async (params: URLSearchParams, signal: AbortSignal) => {
      const requestParams = new URLSearchParams(params.toString());
      requestParams.set('branchId', branchId);
      requestParams.set('limit', String(initialResult.pageSize));
      const response = await fetch(`/api/outlets?${requestParams.toString()}`, { signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal memuat daftar outlet'));
      }
      return toPagedResult(payload);
    },
    [branchId, initialResult.pageSize]
  );
  const { result, draftQuery, setDraftQuery, submitSearch, goToPage, isFetching, error, retry } =
    useUrlList({ initialResult, queryKeys: QUERY_KEYS, fetchPage });
  const returnTo = useCurrentReturnTo();

  return (
    <>
      <div className="mb-3">
        <SearchField
          label="Cari outlet"
          ariaLabel="Cari outlet"
          placeholder="Nama outlet"
          value={draftQuery}
          onChange={setDraftQuery}
          onSubmit={submitSearch}
        />
      </div>
      <div className="mb-2 min-h-5 text-xs text-surface-500" aria-live="polite">
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
      <div className="space-y-3" aria-busy={isFetching}>
        {result.items.map((outlet) => (
          <Link
            key={outlet.id}
            href={withReturnTo(`/outlets/${outlet.id}`, returnTo)}
            className="block"
          >
            <Card className="transition-colors hover:bg-surface-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-surface-900">{outlet.name}</p>
                  <p className="text-sm text-surface-500">{outlet.cashierCount} kasir</p>
                </div>
                {outlet.isActive ? (
                  <Badge variant="success">Aktif</Badge>
                ) : (
                  <Badge variant="muted">Nonaktif</Badge>
                )}
              </div>
            </Card>
          </Link>
        ))}
        {result.items.length === 0 && <p className="text-sm text-surface-500">Belum ada outlet.</p>}
      </div>
      <ClientPagination page={result.page} totalPages={result.totalPages} onPageChange={goToPage} />
    </>
  );
}
