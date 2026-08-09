'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Home, ClipboardList, Trophy, Menu, Bell, LogOut } from 'lucide-react';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { href: '/dashboard', label: 'Beranda', icon: Home },
  {
    href: '/assessment',
    label: 'Nilai',
    icon: ClipboardList,
    permission: 'assessment' as Permission,
  },
  { href: '/leaderboard', label: 'Ranking', icon: Trophy, permission: 'leaderboard' as Permission },
  { href: '/menu', label: 'Lainnya', icon: Menu },
];

export function AppShellClient({
  children,
  permissions,
}: {
  children: ReactNode;
  permissions: Permission[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(permissions, item.permission)
  );
  const canNotifications = hasPermission(permissions, 'notifications');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!canNotifications) return;
    const controller = new AbortController();

    fetch('/api/notifications?limit=1', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json().catch(() => null))
      .then((payload: { unreadCount?: unknown } | null) => {
        if (typeof payload?.unreadCount === 'number') setUnreadCount(Math.max(0, payload.unreadCount));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
      });

    const handleUnreadCount = (event: Event) => {
      const count = (event as CustomEvent<{ count?: unknown }>).detail?.count;
      if (typeof count === 'number') setUnreadCount(Math.max(0, count));
    };
    window.addEventListener('notifications:unread-count', handleUnreadCount);

    return () => {
      controller.abort();
      window.removeEventListener('notifications:unread-count', handleUnreadCount);
    };
  }, [canNotifications]);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-app flex-col border-x border-surface-200 bg-surface-50 md:max-w-7xl md:flex-row">
      <aside className="hidden shrink-0 border-r border-surface-200 bg-white md:flex md:w-60 md:flex-col">
        <Link href="/dashboard" prefetch className="flex h-16 items-center gap-2 border-b border-surface-200 px-5">
          <BrandLogo size={32} alt="" priority />
          <span className="font-semibold text-surface-900">KPI Kasir</span>
        </Link>
        <nav aria-label="Navigasi utama" className="flex-1 space-y-1 p-3">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary-50 font-semibold text-primary-700'
                    : 'text-surface-500 hover:bg-surface-100 hover:text-surface-900'
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-surface-200 bg-white px-4 md:h-16 md:px-6">
          <Link href="/dashboard" prefetch className="flex min-w-0 items-center gap-2 md:hidden">
            <BrandLogo size={32} alt="" priority />
            <span className="truncate font-semibold text-surface-900">KPI Kasir</span>
          </Link>
          <span className="hidden text-sm font-medium text-surface-500 md:block">Area kerja</span>
          <nav aria-label="Aksi akun" className="ml-auto flex items-center gap-2">
          {canNotifications && (
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
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-danger-600 hover:bg-danger-500/10"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar
          </button>
        </nav>
        </header>

        <main data-page-content className="min-w-0 flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>

        <nav aria-label="Navigasi utama" className="fixed inset-x-0 bottom-0 z-40 mx-auto border-t border-surface-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          <div
            className="grid min-h-16"
            style={{ gridTemplateColumns: `repeat(${visibleNavItems.length}, minmax(0, 1fr))` }}
          >
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors',
                    active
                      ? 'font-semibold text-primary-600'
                      : 'text-surface-500 hover:text-surface-900'
                  )}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary-600' : 'text-surface-500')} />
                  <span className="max-w-full truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
