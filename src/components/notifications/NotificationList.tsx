'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bell, AlertTriangle, Info } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Feedback';
import { formatDateTime } from '@/lib/utils';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
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

export function NotificationList() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal memuat');
        return;
      }
      setNotifications(data.notifications ?? []);
    } catch {
      setError('Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    router.refresh();
  }

  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );

  if (error) return <p className="py-8 text-center text-sm text-danger-600">{error}</p>;

  if (notifications.length === 0) {
    return <p className="py-8 text-center text-sm text-surface-500">Belum ada notifikasi.</p>;
  }

  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Card
          key={n.id}
          className={`flex cursor-pointer gap-3 transition-colors ${n.is_read ? '' : 'border-primary-200 bg-primary-50/50'}`}
          onClick={() => !n.is_read && markRead(n.id)}
        >
          {getNotificationIcon(n.type)}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-surface-900">{n.title}</p>
              {!n.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-600" />}
            </div>
            <p className="mt-0.5 text-sm text-surface-600">{n.body}</p>
            <p className="mt-1 text-xs text-surface-400">{formatDateTime(n.created_at)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}