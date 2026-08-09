'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListSkeleton, Spinner } from '@/components/ui/Feedback';

export interface DataListProps<T> {
  fetcher: (page: number, limit: number) => Promise<T[]>;
  renderItem: (item: T, index: number) => React.ReactNode;
  pageSize?: number;
  empty?: React.ReactNode;
  keyExtractor: (item: T) => string;
}

export function DataList<T>({ fetcher, renderItem, pageSize = 20, empty, keyExtractor }: DataListProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const data = await fetcher(nextPage, pageSize);
        setItems((prev) => (append ? [...prev, ...data] : data));
        setHasMore(data.length === pageSize);
        setPage(nextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data');
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetcher, pageSize]
  );

  useEffect(() => {
    loadPage(0, false);
  }, [loadPage]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadPage(page + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, loadPage]);

  if (loading) return <ListSkeleton />;

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="mb-3 text-sm text-danger-600">{error}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => loadPage(0, false)}
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return <>{empty ?? <div className="p-4 text-center text-sm text-surface-500">Tidak ada data</div>}</>;
  }

  return (
    <>
      <div className="divide-y divide-surface-200">
        {items.map((item, index) => (
          <div key={keyExtractor(item)}>{renderItem(item, index)}</div>
        ))}
      </div>
      <div ref={sentinelRef} className="h-1" aria-hidden="true" />
      {loadingMore && (
        <div className="flex justify-center py-3">
          <Spinner className="h-5 w-5" />
        </div>
      )}
      {!hasMore && items.length > 0 && (
        <p className="py-4 text-center text-xs text-surface-400">Sudah semua</p>
      )}
    </>
  );
}
