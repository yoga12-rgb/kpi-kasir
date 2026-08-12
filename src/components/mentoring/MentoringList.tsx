'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { appQueryKeys } from '@/lib/client/query-keys';
import { useCurrentReturnTo } from '@/lib/client/use-current-return-to';
import { buildPath, withReturnTo } from '@/lib/navigation';
import { formatDate } from '@/lib/utils';

const PAGE_SIZE = 20;

interface BranchOption {
  id: string;
  name: string;
}

interface OutletOption {
  id: string;
  name: string;
  branch_id: string;
}

interface Filters {
  branchId: string;
  outletId: string;
  from: string;
  to: string;
}

interface MentoringSessionItem {
  id: string;
  visited_date: string;
  outlet: { name?: string } | { name?: string }[] | null;
  conducted_by: { full_name?: string } | { full_name?: string }[] | null;
}

interface SessionsResponse {
  sessions: MentoringSessionItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

function getRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

async function fetchSessions(filters: Filters, cursor?: string | null, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.outletId) params.set('outletId', filters.outletId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(`/api/mentoring-sessions?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
  const data = (await response.json().catch(() => null)) as
    (Partial<SessionsResponse> & { error?: string }) | null;

  if (!response.ok || !data || !Array.isArray(data.sessions)) {
    throw new Error(data?.error ?? 'Gagal memuat sesi pendampingan');
  }

  return {
    sessions: data?.sessions ?? [],
    nextCursor: data?.nextCursor ?? null,
    hasMore: data?.hasMore ?? false,
  };
}

function SessionSkeleton() {
  return (
    <Card>
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-2 h-3 w-2/3" />
    </Card>
  );
}

function SessionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat sesi pendampingan">
      {Array.from({ length: count }).map((_, index) => (
        <SessionSkeleton key={index} />
      ))}
    </div>
  );
}

export function MentoringList({
  branches,
  outlets,
}: {
  branches: BranchOption[];
  outlets: OutletOption[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = useCurrentReturnTo();
  const [filters, setFilters] = useState<Filters>(() => ({
    branchId: searchParams.get('branchId') ?? '',
    outletId: searchParams.get('outletId') ?? '',
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
  }));
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFilters({
      branchId: searchParams.get('branchId') ?? '',
      outletId: searchParams.get('outletId') ?? '',
      from: searchParams.get('from') ?? '',
      to: searchParams.get('to') ?? '',
    });
  }, [searchParams]);

  const visibleOutlets = useMemo(
    () =>
      filters.branchId
        ? outlets.filter((outlet) => outlet.branch_id === filters.branchId)
        : outlets,
    [filters.branchId, outlets]
  );

  const dateRangeError = filters.from && filters.to && filters.from > filters.to;

  const mentoringQuery = useInfiniteQuery<SessionsResponse, Error>({
    queryKey: appQueryKeys.mentoringSessions(
      filters.branchId,
      filters.outletId,
      filters.from,
      filters.to
    ),
    queryFn: ({ pageParam, signal }) =>
      fetchSessions(filters, pageParam as string | null, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    enabled: !dateRangeError,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const sessions = useMemo(() => {
    const seen = new Set<string>();
    return (mentoringQuery.data?.pages.flatMap((page) => page.sessions) ?? []).filter((session) => {
      if (seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    });
  }, [mentoringQuery.data]);
  const loading = !dateRangeError && mentoringQuery.isPending;
  const loadingMore = mentoringQuery.isFetchingNextPage;
  const error = mentoringQuery.error?.message ?? null;
  const hasMore = !dateRangeError && (mentoringQuery.hasNextPage ?? false);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void mentoringQuery.fetchNextPage();
  }, [hasMore, loading, loadingMore, mentoringQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || loading || loadingMore || !hasMore || error) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '0px 0px 320px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [error, hasMore, loadMore, loading, loadingMore]);

  function resetFilters() {
    setFilters({ branchId: '', outletId: '', from: '', to: '' });
    router.replace(pathname);
  }

  function updateFilters(nextFilters: Filters) {
    setFilters(nextFilters);
    router.replace(
      buildPath(pathname, {
        branchId: nextFilters.branchId,
        outletId: nextFilters.outletId,
        from: nextFilters.from,
        to: nextFilters.to,
      })
    );
  }

  function retry() {
    if (sessions.length > 0 && mentoringQuery.hasNextPage) {
      void loadMore();
      return;
    }
    void mentoringQuery.refetch();
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary-600" />
            <h2 className="text-sm font-semibold text-surface-900">Filter Pendampingan</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            title="Reset filter"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Reset</span>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            id="mentoring-branch-filter"
            label="Cabang"
            value={filters.branchId}
            onChange={(event) =>
              updateFilters({ ...filters, branchId: event.target.value, outletId: '' })
            }
            options={[
              { value: '', label: 'Semua cabang' },
              ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
            ]}
          />
          <Select
            id="mentoring-outlet-filter"
            label="Outlet"
            value={filters.outletId}
            onChange={(event) =>
              updateFilters({ ...filters, outletId: event.target.value })
            }
            options={[
              { value: '', label: 'Semua outlet' },
              ...visibleOutlets.map((outlet) => ({ value: outlet.id, label: outlet.name })),
            ]}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="mentoring-from-filter"
            label="Dari tanggal"
            type="date"
            value={filters.from}
            onChange={(event) =>
              updateFilters({ ...filters, from: event.target.value })
            }
          />
          <Input
            id="mentoring-to-filter"
            label="Sampai tanggal"
            type="date"
            value={filters.to}
            onChange={(event) => updateFilters({ ...filters, to: event.target.value })}
          />
        </div>

        {dateRangeError && (
          <p className="text-xs text-danger-600">
            Tanggal mulai tidak boleh setelah tanggal akhir.
          </p>
        )}
      </Card>

      {loading && <SessionListSkeleton />}

      {!loading && error && sessions.length === 0 && (
        <div className="py-8 text-center">
          <p className="mb-3 text-sm text-danger-600">{error}</p>
          <Button type="button" variant="secondary" onClick={retry}>
            Coba lagi
          </Button>
        </div>
      )}

      {!loading && !error && !dateRangeError && sessions.length === 0 && (
        <EmptyState
          title="Belum ada sesi pendampingan"
          description="Data akan muncul setelah sesi pendampingan dicatat."
        />
      )}

      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => {
            const outlet = getRelation(session.outlet);
            const conductedBy = getRelation(session.conducted_by);

            return (
              <Link
                key={session.id}
                href={withReturnTo(`/mentoring/${session.id}`, returnTo)}
                className="block"
              >
                <Card className="flex items-center justify-between transition-colors hover:bg-surface-100">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-surface-900">{outlet?.name ?? '-'}</p>
                    <p className="text-sm text-surface-500">
                      {formatDate(session.visited_date)} | oleh {conductedBy?.full_name ?? '-'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-surface-400" />
                </Card>
              </Link>
            );
          })}

          {error && (
            <div className="py-3 text-center">
              <p className="mb-2 text-sm text-danger-600">{error}</p>
              <Button type="button" variant="secondary" size="sm" onClick={retry}>
                Coba lagi
              </Button>
            </div>
          )}

          {loadingMore && <SessionListSkeleton count={2} />}

          <div ref={sentinelRef} className="h-1" aria-hidden="true" />
          {!hasMore && (
            <p className="py-3 text-center text-xs text-surface-400">Semua sesi telah dimuat.</p>
          )}
        </div>
      )}
    </div>
  );
}
