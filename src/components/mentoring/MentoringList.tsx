'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Calendar, ChevronRight, Images, RotateCcw, SlidersHorizontal, UserRound, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/Feedback';
import { Input, Select } from '@/components/ui/Form';
import { BottomSheet } from '@/components/ui/Overlay';
import { cn } from '@/lib/cn';
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
  note_outlet: string | null;
  outlet: { name?: string; branch_id?: string; branch?: { name?: string | null } | null } | { name?: string }[] | null;
  conducted_by: { full_name?: string } | { full_name?: string }[] | null;
  mentoring_cashier_note?: { count?: number } | { count?: number }[];
  mentoring_evidence?: { count?: number } | { count?: number }[];
}

interface SessionsResponse {
  sessions: MentoringSessionItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

function getRelation<T>(relation: T | T[] | null | undefined) {
  return Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);
}

function getCount(value: { count?: number } | { count?: number }[] | undefined) {
  if (!value) return 0;
  if (Array.isArray(value)) return value[0]?.count ?? 0;
  return value.count ?? 0;
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
  const [sheetOpen, setSheetOpen] = useState(false);

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

  const activeFilterCount =
    (filters.branchId ? 1 : 0) +
    (filters.outletId ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0);
  const isDirty = activeFilterCount > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
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

        {isDirty && (
          <button
            type="button"
            onClick={resetFilters}
            aria-label="Reset filter"
            title="Reset filter"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-300 bg-white text-surface-600 transition-colors hover:bg-surface-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {dateRangeError && (
        <p className="text-xs text-danger-600">
          Tanggal mulai tidak boleh setelah tanggal akhir.
        </p>
      )}

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
            const notesCount = getCount(session.mentoring_cashier_note);
            const evidenceCount = getCount(session.mentoring_evidence);

            return (
              <Link
                key={session.id}
                href={withReturnTo(`/mentoring/${session.id}`, returnTo)}
                className="block"
              >
                <Card className="transition-colors hover:bg-surface-100">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-surface-900">{outlet?.name ?? '-'}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-surface-400" aria-hidden="true" />
                          {formatDate(session.visited_date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5 text-surface-400" aria-hidden="true" />
                          {conductedBy?.full_name ?? '-'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-surface-400" aria-hidden="true" />
                          {notesCount} kasir
                        </span>
                        {evidenceCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Images className="h-3.5 w-3.5 text-surface-400" aria-hidden="true" />
                            {evidenceCount} foto
                          </span>
                        )}
                      </div>
                      {session.note_outlet && (
                        <p className="mt-1 line-clamp-2 text-xs text-surface-500">
                          {session.note_outlet}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-surface-400" />
                  </div>
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

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Filter pendampingan">
        <div className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
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
          <Button type="button" fullWidth onClick={() => setSheetOpen(false)}>
            Terapkan
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
