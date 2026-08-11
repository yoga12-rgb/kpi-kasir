import { cache } from 'react';
import type { UserRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { CONFIGURABLE_PERMISSIONS, type Permission } from './permissions';
import { logServerPerformance, nowMs } from '@/lib/performance/server';

export const getRolePermissions = cache(async (role: UserRole): Promise<Permission[]> => {
  const startedAt = nowMs();
  if (role === 'admin') {
    logServerPerformance('role-permissions', {
      durationMs: Number((nowMs() - startedAt).toFixed(1)),
      role,
      source: 'static',
    });
    return [...CONFIGURABLE_PERMISSIONS];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permission')
    .select('permission')
    .eq('role', role)
    .eq('enabled', true);

  if (error) throw error;

  const permissions = (data ?? [])
    .map((row) => row.permission as Permission)
    .filter((permission) => (CONFIGURABLE_PERMISSIONS as readonly string[]).includes(permission));
  logServerPerformance('role-permissions', {
    durationMs: Number((nowMs() - startedAt).toFixed(1)),
    role,
    source: 'database',
    permissionCount: permissions.length,
  });
  return permissions;
});
