import { Suspense, type ReactNode } from 'react';
import { AppShellClient } from '@/components/layout/AppShellClient';
import { NotificationBell, NotificationBellFallback } from '@/components/notifications/NotificationBell';
import { getCurrentUser } from '@/lib/auth/session';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { hasPermission } from '@/lib/auth/permissions';

export async function AppShell({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();
  const permissions = currentUser?.profile
    ? await getRolePermissions(currentUser.profile.role)
    : [];
  const notification =
    currentUser?.profile && hasPermission(permissions, 'notifications') ? (
      <Suspense fallback={<NotificationBellFallback />}>
        <NotificationBell userId={currentUser.profile.id} />
      </Suspense>
    ) : null;

  return (
    <AppShellClient permissions={permissions} notification={notification}>
      {children}
    </AppShellClient>
  );
}
