'use client';

import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { appQueryKeys } from '@/lib/client/query-keys';

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface UseUrlListOptions<T> {
  initialResult: PagedResult<T>;
  queryKeys: string[];
  fetchPage: (params: URLSearchParams, signal: AbortSignal) => Promise<PagedResult<T>>;
}

function getUrlKey(params: URLSearchParams, queryKeys: string[]) {
  return queryKeys.map((key) => `${key}=${params.get(key) ?? ''}`).join('&');
}

function toPath(pathname: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function useUrlList<T>({ initialResult, queryKeys, fetchPage }: UseUrlListOptions<T>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routerQueryString = searchParams.toString();
  const [localQueryString, setLocalQueryString] = useState(routerQueryString);
  const queryClient = useQueryClient();
  const [initialKey] = useState(() =>
    getUrlKey(new URLSearchParams(routerQueryString), queryKeys)
  );
  const initialSignature = useMemo(() => JSON.stringify(initialResult), [initialResult]);
  const lastInitialSignatureRef = useRef(initialSignature);
  const currentParams = useMemo(
    () => new URLSearchParams(localQueryString),
    [localQueryString]
  );
  const currentKey = useMemo(
    () => getUrlKey(currentParams, queryKeys),
    [currentParams, queryKeys]
  );
  const queryKey = useMemo(
    () =>
      appQueryKeys.urlList(
        pathname,
        queryKeys.map((key) => `${key}=${currentParams.get(key) ?? ''}`)
      ),
    [currentParams, pathname, queryKeys]
  );

  useEffect(() => {
    setLocalQueryString(routerQueryString);
  }, [routerQueryString]);

  const query = useQuery<PagedResult<T>, Error>({
    queryKey,
    queryFn: ({ signal }) => fetchPage(new URLSearchParams(currentParams.toString()), signal),
    initialData: currentKey === initialKey ? initialResult : undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (lastInitialSignatureRef.current === initialSignature) return;
    lastInitialSignatureRef.current = initialSignature;
    if (currentKey === initialKey) {
      queryClient.setQueryData(queryKey, initialResult);
    }
  }, [currentKey, initialKey, initialResult, initialSignature, queryClient, queryKey]);

  const [draftQuery, setDraftQuery] = useState(currentParams.get('q') ?? '');

  useEffect(() => {
    setDraftQuery(currentParams.get('q') ?? '');
  }, [currentParams]);

  const updateUrl = useCallback(
    (updates: Record<string, string | null>, mode: 'replace' | 'push') => {
      const nextParams = new URLSearchParams(currentParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) nextParams.set(key, value);
        else nextParams.delete(key);
      });
      const nextKey = getUrlKey(nextParams, queryKeys);
      if (nextKey === currentKey) return;

      const nextPath = toPath(pathname, nextParams);
      if (mode === 'replace') {
        window.history.replaceState(null, '', nextPath);
      } else {
        window.history.pushState(null, '', nextPath);
      }
      setLocalQueryString(nextParams.toString());
    },
    [currentKey, currentParams, pathname, queryKeys]
  );

  const submitSearch = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      updateUrl({ q: draftQuery.trim() || null, page: null }, 'replace');
    },
    [draftQuery, updateUrl]
  );

  const goToPage = useCallback(
    (page: number) => {
      updateUrl({ page: page > 1 ? String(page) : null }, 'push');
    },
    [updateUrl]
  );

  const replaceParams = useCallback(
    (updates: Record<string, string | null>) => updateUrl(updates, 'replace'),
    [updateUrl]
  );

  const retry = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    result: query.data ?? initialResult,
    draftQuery,
    setDraftQuery,
    submitSearch,
    goToPage,
    replaceParams,
    isPending: query.isFetching,
    error: query.error?.message ?? null,
    retry,
  };
}
