'use client';

import { useCallback } from 'react';
import { SearchField } from '@/components/search/SearchField';
import { ClientPagination } from '@/components/search/ClientPagination';
import { UserManagementList, type ManagedUser } from '@/components/settings/UserManagementList';
import { useUrlList, type PagedResult } from '@/lib/client/use-url-list';
import { getErrorMessage } from '@/lib/utils';

const QUERY_KEYS = ['q', 'page'];

function toPagedResult(payload: unknown): PagedResult<ManagedUser> {
  const data = (payload as { users?: ManagedUser[] }).users ?? [];
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
    items: data,
    page,
    pageSize,
    total,
    totalPages: response.totalPages ?? Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function UserListClient({
  initialResult,
  currentUserId,
}: {
  initialResult: PagedResult<ManagedUser>;
  currentUserId: string;
}) {
  const fetchPage = useCallback(
    async (params: URLSearchParams, signal: AbortSignal) => {
      const requestParams = new URLSearchParams(params.toString());
      requestParams.set('limit', String(initialResult.pageSize));
      const response = await fetch(`/api/users?${requestParams.toString()}`, { signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal memuat daftar pengguna'));
      }
      return toPagedResult(payload);
    },
    [initialResult.pageSize]
  );
  const { result, draftQuery, setDraftQuery, submitSearch, goToPage, isPending, error, retry } =
    useUrlList({ initialResult, queryKeys: QUERY_KEYS, fetchPage });

  return (
    <>
      <div className="mb-3">
        <SearchField
          label="Cari pengguna"
          ariaLabel="Cari pengguna"
          placeholder="Nama atau email"
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
      <div aria-busy={isPending}>
        <UserManagementList initialUsers={result.items} currentUserId={currentUserId} />
      </div>
      <ClientPagination page={result.page} totalPages={result.totalPages} onPageChange={goToPage} />
    </>
  );
}
