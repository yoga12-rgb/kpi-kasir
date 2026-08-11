'use client';

import { useCallback } from 'react';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { ClientPagination } from '@/components/search/ClientPagination';
import { SearchField } from '@/components/search/SearchField';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { NavigationLink } from '@/components/ui/NavigationLink';
import { useUrlList, type PagedResult } from '@/lib/client/use-url-list';
import { getErrorMessage } from '@/lib/utils';

const QUERY_KEYS = ['q', 'page'];

export interface BranchListItem {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  outletCount: number;
}

interface ApiBranch {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
  outlet?: Array<{ count?: number }>;
}

function toPagedResult(payload: unknown): PagedResult<BranchListItem> {
  const data = (payload as { branches?: ApiBranch[] }).branches ?? [];
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
    items: data.map((branch) => ({
      id: branch.id,
      name: branch.name,
      code: branch.code,
      isActive: branch.is_active,
      outletCount: branch.outlet?.[0]?.count ?? 0,
    })),
    page,
    pageSize,
    total,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function BranchListClient({
  initialResult,
  canCreate,
}: {
  initialResult: PagedResult<BranchListItem>;
  canCreate: boolean;
}) {
  const fetchPage = useCallback(
    async (params: URLSearchParams, signal: AbortSignal) => {
      const requestParams = new URLSearchParams(params.toString());
      requestParams.set('limit', String(initialResult.pageSize));
      const response = await fetch(`/api/branches?${requestParams.toString()}`, { signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal memuat daftar cabang'));
      }
      return toPagedResult(payload);
    },
    [initialResult.pageSize]
  );
  const { result, draftQuery, setDraftQuery, submitSearch, goToPage, isPending, error, retry } =
    useUrlList({ initialResult, queryKeys: QUERY_KEYS, fetchPage });

  return (
    <>
      <div className="mt-4 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <SearchField
            label="Cari cabang"
            ariaLabel="Cari cabang"
            placeholder="Nama atau kode cabang"
            value={draftQuery}
            onChange={setDraftQuery}
            onSubmit={submitSearch}
          />
        </div>
        {canCreate && (
          <Link
            href="/branches/new"
            className="btn btn-primary flex h-10 shrink-0 items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah</span>
          </Link>
        )}
      </div>

      <div className="mt-2 min-h-5 text-xs text-surface-500" aria-live="polite">
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

      <div className="mt-2 space-y-3" aria-busy={isPending}>
        {result.items.map((branch) => (
          <NavigationLink
            key={branch.id}
            href={`/branches/${branch.id}`}
            pendingIndicator
            className="block"
          >
            <Card className="transition-colors hover:bg-surface-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-surface-900">{branch.name}</p>
                  <p className="text-sm text-surface-500">
                    {branch.code ?? '-'} &middot; {branch.outletCount} outlet
                  </p>
                </div>
                {branch.isActive ? (
                  <Badge variant="success">Aktif</Badge>
                ) : (
                  <Badge variant="muted">Nonaktif</Badge>
                )}
              </div>
            </Card>
          </NavigationLink>
        ))}
        {result.items.length === 0 && (
          <p className="py-8 text-center text-sm text-surface-500">Belum ada cabang.</p>
        )}
      </div>

      <ClientPagination page={result.page} totalPages={result.totalPages} onPageChange={goToPage} />
    </>
  );
}
