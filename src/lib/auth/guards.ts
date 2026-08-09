import { redirect } from 'next/navigation';
import { getCurrentUser } from './session';
import type { UserRole } from '@/types/database';
import { getRolePermissions } from './permissions-server';
import { hasPermission, type Permission } from './permissions';

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.profile) redirect('/login');
  if (!user.profile.is_active) {
    redirect('/login?error=inactive');
  }
  return user.profile;
}

export async function requireRole(roles: UserRole[]) {
  const profile = await requireUser();
  if (!roles.includes(profile.role)) {
    redirect('/dashboard');
  }
  return profile;
}

export async function requireAdmin() {
  return requireRole(['admin']);
}

export async function requireManagerOrSupervisor() {
  return requireRole(['manager', 'supervisor']);
}

export async function requirePermission(permission: Permission) {
  const profile = await requireUser();
  if (profile.role !== 'admin') {
    const permissions = await getRolePermissions(profile.role);
    if (!hasPermission(permissions, permission)) {
      redirect('/dashboard?error=forbidden');
    }
  }
  return profile;
}

export async function requireAnyPermission(permissions: Permission[]) {
  const profile = await requireUser();
  if (profile.role !== 'admin') {
    const currentPermissions = await getRolePermissions(profile.role);
    if (!permissions.some((permission) => hasPermission(currentPermissions, permission))) {
      redirect('/dashboard?error=forbidden');
    }
  }
  return profile;
}

/**
 * Guard untuk akses cabang.
 * - Admin: akses semua.
 * - Manager/Supervisor: hanya cabang yang ditugaskan.
 */
export async function requireBranchAccess(branchIds: string[]) {
  const profile = await requireUser();

  if (profile.role === 'admin') return profile;

  const { getUserBranches } = await import('./session');
  const userBranchIds = await getUserBranches(profile.id);

  const hasAccess = branchIds.every((bid) => userBranchIds.includes(bid));
  if (!hasAccess) {
    redirect('/dashboard');
  }

  return profile;
}

export async function requireCashierAccess(cashierId: string, branchId: string) {
  return requireBranchAccess([branchId]);
}
