interface NotificationCacheItem {
  id: string;
  is_read: boolean;
}

interface NotificationCachePage<TItem extends NotificationCacheItem> {
  notifications: TItem[];
  unreadCount: number;
}

export function markNotificationReadInPages<
  TItem extends NotificationCacheItem,
  TPage extends NotificationCachePage<TItem>,
>(pages: TPage[], notificationId: string): TPage[] {
  const shouldDecrementUnread = pages.some((page) =>
    page.notifications.some(
      (notification) => notification.id === notificationId && !notification.is_read
    )
  );

  if (!shouldDecrementUnread) return pages;

  return pages.map((page) => ({
    ...page,
    unreadCount: Math.max(0, page.unreadCount - 1),
    notifications: page.notifications.map((notification) =>
      notification.id === notificationId
        ? { ...notification, is_read: true }
        : notification
    ),
  })) as TPage[];
}
