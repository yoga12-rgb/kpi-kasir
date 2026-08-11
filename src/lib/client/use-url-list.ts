'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

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
  const currentParams = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);
  const currentKey = useMemo(() => getUrlKey(currentParams, queryKeys), [currentParams, queryKeys]);
  const [result, setResult] = useState(initialResult);
  const [draftQuery, setDraftQuery] = useState(currentParams.get('q') ?? '');
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);
  const lastLoadedKeyRef = useRef(currentKey);
  const initialDataSignature = useMemo(() => JSON.stringify(initialResult), [initialResult]);

  const load = useCallback(
    async (params: URLSearchParams, key: string) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsPending(true);
      setError(null);

      try {
        const nextResult = await fetchPage(params, controller.signal);
        if (!mountedRef.current || controller.signal.aborted) return;
        const liveParams = new URLSearchParams(window.location.search);
        if (getUrlKey(liveParams, queryKeys) !== key) return;
        setResult(nextResult);
      } catch (reason: unknown) {
        if (!mountedRef.current || controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Gagal memuat data');
      } finally {
        if (mountedRef.current && controllerRef.current === controller) {
          controllerRef.current = null;
          setIsPending(false);
        }
      }
    },
    [fetchPage, queryKeys]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setDraftQuery(currentParams.get('q') ?? '');
    if (currentKey === lastLoadedKeyRef.current) return;
    lastLoadedKeyRef.current = currentKey;
    void load(currentParams, currentKey);
  }, [currentKey, currentParams, load]);

  // Mutation forms may refresh the server props while the URL stays unchanged.
  useEffect(() => {
    if (!isPending) setResult(initialResult);
    // The signature prevents this from replacing client-fetched rows on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataSignature]);

  const updateUrl = useCallback(
    (updates: Record<string, string | null>, mode: 'replace' | 'push') => {
      const nextParams = new URLSearchParams(currentParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) nextParams.set(key, value);
        else nextParams.delete(key);
      });
      const nextKey = getUrlKey(nextParams, queryKeys);
      if (nextKey === currentKey) return;

      lastLoadedKeyRef.current = nextKey;
      const nextPath = toPath(pathname, nextParams);
      if (mode === 'replace') {
        window.history.replaceState(null, '', nextPath);
      } else {
        window.history.pushState(null, '', nextPath);
      }
      void load(nextParams, nextKey);
    },
    [currentKey, currentParams, load, pathname, queryKeys]
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
    lastLoadedKeyRef.current = '';
    void load(currentParams, currentKey);
  }, [currentKey, currentParams, load]);

  return {
    result,
    draftQuery,
    setDraftQuery,
    submitSearch,
    goToPage,
    replaceParams,
    isPending,
    error,
    retry,
  };
}
