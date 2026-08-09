import type { UserRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { CONFIGURABLE_PERMISSIONS, type Permission } from './permissions';

export async function getRolePermissions(role: UserRole): Promise<Permission[]> {
  if (role === 'admin') return [...CONFIGURABLE_PERMISSIONS];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('role_permission')
    .select('permission')
    .eq('role', role)
    .eq('enabled', true);

  if (error) throw error;

  return (data ?? [])
    .map((row) => row.permission as Permission)
    .filter((permission) => (CONFIGURABLE_PERMISSIONS as readonly string[]).includes(permission));
}
