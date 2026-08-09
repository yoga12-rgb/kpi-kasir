import { type ReactNode } from 'react';
import { AppShellClient } from '@/components/layout/AppShellClient';
import { getCurrentUser } from '@/lib/auth/session';
import { getRolePermissions } from '@/lib/auth/permissions-server';

export async function AppShell({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();
  const permissions = currentUser?.profile
    ? await getRolePermissions(currentUser.profile.role)
    : [];

  return <AppShellClient permissions={permissions}>{children}</AppShellClient>;
}
