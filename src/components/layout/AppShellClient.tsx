'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { Home, ClipboardList, Trophy, Menu, LogOut } from 'lucide-react';
import { signOutAction } from '@/app/(app)/actions';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { hasPermission, type Permission } from '@/lib/auth/permissions';
import { cn } from '@/lib/cn';

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
  notification,
}: {
  children: ReactNode;
  permissions: Permission[];
  notification?: ReactNode;
}) {
  const pathname = usePathname();
  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(permissions, item.permission)
  );

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

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
            {notification}
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium text-danger-600 hover:bg-danger-500/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                Keluar
              </button>
            </form>
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
