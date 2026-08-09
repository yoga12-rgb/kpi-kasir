'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode } from 'react';
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

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href));

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="mx-auto min-h-screen max-w-app border-x border-surface-200 bg-surface-50">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-surface-200 bg-white px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandLogo size={32} alt="" priority />
          <span className="font-semibold text-surface-900">KPI Kasir</span>
        </Link>
        <nav className="flex items-center gap-2">
          {hasPermission(permissions, 'notifications') && (
            <Link
              href="/notifications"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-surface-600 hover:bg-surface-100"
              aria-label="Notifikasi"
            >
              <Bell className="h-5 w-5" />
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

      <main data-page-content className="pb-20">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-surface-200 bg-white">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${visibleNavItems.length}, minmax(0, 1fr))` }}
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
                  active
                    ? 'font-semibold text-primary-600'
                    : 'text-surface-500 hover:text-surface-900'
                )}
              >
                <Icon className={cn('h-5 w-5', active ? 'text-primary-600' : 'text-surface-500')} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
