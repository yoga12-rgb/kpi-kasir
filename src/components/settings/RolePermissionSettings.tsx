'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Feedback';
import { Toast } from '@/components/ui/Overlay';
import { appQueryKeys } from '@/lib/client/query-keys';
import {
  CONFIGURABLE_PERMISSIONS,
  PERMISSION_DETAILS,
  type Permission,
} from '@/lib/auth/permissions';

type ConfigurableRole = 'manager' | 'supervisor';

interface RolePermissionState {
  role: ConfigurableRole;
  permissions: Record<Permission, boolean>;
}

interface PermissionMutationVariables {
  role: ConfigurableRole;
  permission: Permission;
  enabled: boolean;
}

interface PermissionMutationContext {
  previousRoles: RolePermissionState[] | undefined;
}

const roleLabels: Record<ConfigurableRole, string> = {
  manager: 'Manager',
  supervisor: 'Supervisor',
};

function updateRolePermission(
  roles: RolePermissionState[],
  role: ConfigurableRole,
  permission: Permission,
  enabled: boolean
) {
  return roles.map((item) =>
    item.role === role
      ? { ...item, permissions: { ...item.permissions, [permission]: enabled } }
      : item
  );
}

export function RolePermissionSettings() {
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );
  const queryClient = useQueryClient();
  const rolesQuery = useQuery<RolePermissionState[], Error>({
    queryKey: appQueryKeys.rolePermissions,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/role-permissions', { signal });
      const data = (await response.json().catch(() => null)) as {
        roles?: RolePermissionState[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Gagal memuat hak akses role');
      return data?.roles ?? [];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const permissionMutation = useMutation<
    void,
    Error,
    PermissionMutationVariables,
    PermissionMutationContext
  >({
    mutationFn: async ({ role, permission, enabled }) => {
      const response = await fetch('/api/role-permissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, permission, enabled }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? 'Gagal menyimpan hak akses');
    },
    onMutate: async ({ role, permission, enabled }) => {
      await queryClient.cancelQueries({ queryKey: appQueryKeys.rolePermissions });
      const previousRoles = queryClient.getQueryData<RolePermissionState[]>(appQueryKeys.rolePermissions);
      queryClient.setQueryData<RolePermissionState[]>(
        appQueryKeys.rolePermissions,
        (current) => updateRolePermission(current ?? [], role, permission, enabled)
      );
      setSaving(`${role}:${permission}`);
      setToast(null);
      return { previousRoles };
    },
    onSuccess: () => {
      setToast({ message: 'Hak akses diperbarui', variant: 'success' });
    },
    onError: (error, _variables, context) => {
      if (context?.previousRoles) {
        queryClient.setQueryData(appQueryKeys.rolePermissions, context.previousRoles);
      }
      setToast({ message: error.message, variant: 'error' });
    },
    onSettled: () => {
      setSaving(null);
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.rolePermissions });
    },
  });

  const roles = rolesQuery.data ?? [];

  if (rolesQuery.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (rolesQuery.error) {
    return <p className="text-sm text-danger-600">{rolesQuery.error.message}</p>;
  }

  return (
    <div className="space-y-3">
      {roles.map((role) => (
        <Card key={role.role}>
          <div className="mb-3">
            <h3 className="font-semibold text-surface-900">{roleLabels[role.role]}</h3>
            <p className="text-xs text-surface-500">Atur fitur yang dapat digunakan role ini.</p>
          </div>

          <div className="divide-y divide-surface-200">
            {CONFIGURABLE_PERMISSIONS.map((permission) => {
              const enabled = role.permissions[permission];
              return (
                <div
                  key={permission}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-900">
                      {PERMISSION_DETAILS[permission].label}
                    </p>
                    <p className="text-xs text-surface-500">
                      {PERMISSION_DETAILS[permission].description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? 'Nonaktifkan' : 'Aktifkan'} ${PERMISSION_DETAILS[permission].label} untuk ${roleLabels[role.role]}`}
                    disabled={saving !== null}
                    onClick={() =>
                      permissionMutation.mutate({
                        role: role.role,
                        permission,
                        enabled: !enabled,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-50 disabled:cursor-wait disabled:opacity-60 ${
                      enabled ? 'bg-primary-500' : 'bg-surface-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        enabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
