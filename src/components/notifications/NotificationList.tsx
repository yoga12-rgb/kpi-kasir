'use client';

import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCheck,
  Info,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { EmptyState, ListSkeleton } from '@/components/ui/Feedback';
import { appQueryKeys } from '@/lib/client/query-keys';
import { markNotificationReadInPages } from '@/lib/client/notification-cache';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  entity_type?: string | null;
  entity_id?: string | null;
  period_id?: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationPage {
  notifications: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'reminder_unassessed':
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <Bell className="h-5 w-5" />
        </div>
      );
    case 'low_score_alert':
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-danger-50 text-danger-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
      );
    case 'system':
    default:
      return (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <Info className="h-5 w-5" />
        </div>
      );
  }
}

function getApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function payloadId(notification: NotificationItem, key: string) {
  const value = notification.payload?.[key];
  return validId(value) ? value : null;
}

function getNotificationHref(notification: NotificationItem) {
  const entityId = validId(notification.entity_id)
    ? notification.entity_id
    : payloadId(notification, 'cashier_id');
  if (!entityId) return null;

  if (notification.type === 'reminder_unassessed') return `/assessment/${entityId}`;
  if (notification.type === 'low_score_alert') return `/cashiers/${entityId}`;
  if (notification.entity_type === 'cashier') return `/cashiers/${entityId}`;
  if (notification.entity_type === 'outlet') return `/outlets/${entityId}`;
  return null;
}

function publishUnreadCount(count: number) {
  window.dispatchEvent(new CustomEvent('notifications:unread-count', { detail: { count } }));
}

async function readPage(cursor: string | null, signal?: AbortSignal): Promise<NotificationPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);

  const response = await fetch(`/api/notifications?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
  const payload = (await response.json().catch(() => null)) as Partial<NotificationPage> & {
    error?: unknown;
  };
  if (!response.ok) throw new Error(getApiError(payload, 'Gagal memuat notifikasi'));

  return {
    notifications: Array.isArray(payload.notifications) ? payload.notifications : [],
    nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
    hasMore: payload.hasMore === true,
    unreadCount: typeof payload.unreadCount === 'number' ? payload.unreadCount : 0,
  };
}

export function NotificationList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const notificationsQuery = useInfiniteQuery<NotificationPage, Error>({
    queryKey: appQueryKeys.notifications,
    queryFn: ({ pageParam, signal }) => readPage(pageParam as string | null, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const notifications = useMemo(() => {
    const seen = new Set<string>();
    return (notificationsQuery.data?.pages.flatMap((page) => page.notifications) ?? []).filter(
      (notification) => {
        if (seen.has(notification.id)) return false;
        seen.add(notification.id);
        return true;
      }
    );
  }, [notificationsQuery.data]);
  const unreadCount = notificationsQuery.data?.pages[0]?.unreadCount ?? 0;
  const loading = notificationsQuery.isPending;
  const loadingMore = notificationsQuery.isFetchingNextPage;
  const hasMore = notificationsQuery.hasNextPage ?? false;
  const queryError = notificationsQuery.error?.message ?? null;
  const error = actionError ?? (notifications.length === 0 ? queryError : null);
  const loadMoreError = notificationsQuery.isFetchNextPageError ? queryError : null;

  useEffect(() => {
    publishUnreadCount(unreadCount);
  }, [unreadCount]);

  type NotificationQueryData = InfiniteData<NotificationPage, string | null>;
  const markReadMutation = useMutation<void, Error, string, { previous?: NotificationQueryData }>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, 'Gagal menandai notifikasi'));
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: appQueryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationQueryData>(appQueryKeys.notifications);
      queryClient.setQueryData<NotificationQueryData>(appQueryKeys.notifications, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: markNotificationReadInPages(current.pages, id),
        };
      });
      return { previous };
    },
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(appQueryKeys.notifications, context.previous);
      setActionError(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.notifications, refetchType: 'none' });
    },
  });

  const markAllMutation = useMutation<void, Error, void, { previous?: NotificationQueryData }>({
    mutationFn: async () => {
      const response = await fetch('/api/notifications/read-all', { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getApiError(payload, 'Gagal menandai notifikasi'));
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: appQueryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationQueryData>(appQueryKeys.notifications);
      queryClient.setQueryData<NotificationQueryData>(appQueryKeys.notifications, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            unreadCount: 0,
            notifications: page.notifications.map((notification) => ({
              ...notification,
              is_read: true,
            })),
          })),
        };
      });
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(appQueryKeys.notifications, context.previous);
      setActionError(error.message);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.notifications, refetchType: 'none' });
    },
  });

  function loadMore() {
    if (!hasMore || loadingMore) return;
    setActionError(null);
    void notificationsQuery.fetchNextPage();
  }

  async function markRead(id: string) {
    setActionError(null);
    await markReadMutation.mutateAsync(id);
  }

  async function openNotification(notification: NotificationItem) {
    setActionId(notification.id);
    setActionError(null);
    try {
      if (!notification.is_read) await markRead(notification.id);
      const href = getNotificationHref(notification);
      if (href) router.push(href);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Gagal membuka notifikasi');
    } finally {
      setActionId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || markAllMutation.isPending) return;
    setActionError(null);
    try {
      await markAllMutation.mutateAsync();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : 'Gagal menandai notifikasi');
    }
  }

  if (loading) return <ListSkeleton count={4} />;

  if (error && notifications.length === 0) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-sm text-danger-600">{error}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void notificationsQuery.refetch()}
        >
          <RefreshCw className="mr-1.5 h-4 w-4" />
          Coba lagi
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-surface-500" aria-live="polite">
          {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={unreadCount === 0 || markAllMutation.isPending}
          onClick={() => void markAllRead()}
          aria-label="Tandai semua notifikasi sudah dibaca"
        >
          {markAllMutation.isPending ? (
            <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCheck className="mr-1.5 h-4 w-4" />
          )}
          Tandai semua
        </Button>
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}

      {notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-7 w-7" />}
          title="Belum ada notifikasi"
          description="Reminder dan alert baru akan muncul di sini."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => {
            const href = getNotificationHref(notification);
            const isOpening = actionId === notification.id;
            return (
              <Card
                key={notification.id}
                className={notification.is_read ? '' : 'border-primary-200 bg-primary-50/50'}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                  onClick={() => void openNotification(notification)}
                  disabled={isOpening}
                >
                  {getNotificationIcon(notification.type)}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium text-surface-900">{notification.title}</span>
                      {!notification.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" aria-label="Belum dibaca" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-surface-600">{notification.body}</span>
                    <span className="mt-1 flex items-center gap-1 text-xs text-surface-400">
                      {formatDateTime(notification.created_at)}
                      {href && <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                  </span>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {loadMoreError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2">
          <p className="text-sm text-danger-700">{loadMoreError}</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => void loadMore()}>
            Coba lagi
          </Button>
        </div>
      )}

      {hasMore && !loadMoreError && (
        <Button type="button" variant="secondary" fullWidth onClick={() => void loadMore()} disabled={loadingMore}>
          {loadingMore && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          {loadingMore ? 'Memuat...' : 'Muat lebih banyak'}
        </Button>
      )}
    </div>
  );
}
