'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';

export function NotificationBellClient({ initialUnreadCount }: { initialUnreadCount: number }) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    const handleUnreadCount = (event: Event) => {
      const count = (event as CustomEvent<{ count?: unknown }>).detail?.count;
      if (typeof count === 'number') setUnreadCount(Math.max(0, count));
    };
    window.addEventListener('notifications:unread-count', handleUnreadCount);
    return () => window.removeEventListener('notifications:unread-count', handleUnreadCount);
  }, []);

  return (
    <Link
      href="/notifications"
      prefetch
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-surface-600 hover:bg-surface-100"
      aria-label="Notifikasi"
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold leading-none text-white">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
