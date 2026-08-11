import { Bell } from 'lucide-react';
import { getUnreadNotificationCount } from '@/lib/notifications/unread';
import { NotificationBellClient } from './NotificationBellClient';

export function NotificationBellFallback() {
  return (
    <span
      aria-label="Memuat notifikasi"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-surface-400"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export async function NotificationBell({ userId }: { userId: string }) {
  const unreadCount = await getUnreadNotificationCount(userId);
  return <NotificationBellClient initialUnreadCount={unreadCount ?? 0} />;
}
