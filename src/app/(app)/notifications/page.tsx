import { NotificationList } from '@/components/notifications/NotificationList';
import { requirePermission } from '@/lib/auth/guards';

export default async function NotificationsPage() {
  await requirePermission('notifications');

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Notifikasi</h1>
        <p className="mt-0.5 text-sm text-surface-500">Reminder & alert</p>
        <div className="mt-4">
          <NotificationList />
        </div>
    </div>
  );
}
