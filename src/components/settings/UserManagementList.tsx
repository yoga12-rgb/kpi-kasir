'use client';

import { Check, Loader2, Save } from 'lucide-react';
import { useState } from 'react';
import type { UserRole } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getErrorMessage } from '@/lib/utils';

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_label: string;
}

export function UserManagementList({
  initialUsers,
  currentUserId,
}: {
  initialUsers: ManagedUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveUser(user: ManagedUser) {
    setPendingId(user.id);
    setSavedId(null);
    setError(null);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: user.role, isActive: user.is_active }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        user?: ManagedUser;
      } | null;

      if (!response.ok || !payload?.user) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal menyimpan perubahan pengguna'));
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                role: payload.user?.role ?? item.role,
                is_active: payload.user?.is_active ?? item.is_active,
              }
            : item
        )
      );
      setSavedId(user.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Gagal menyimpan perubahan');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {users.map((user) => {
        const isCurrentUser = user.id === currentUserId;
        const isPending = pendingId === user.id;
        const isSaved = savedId === user.id;

        return (
          <Card key={user.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-surface-900">{user.full_name}</p>
                <p className="truncate text-sm text-surface-500">{user.email}</p>
                <p className="text-xs text-surface-400">Bergabung {user.created_label}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={
                    user.role === 'admin' ? 'danger' : user.role === 'manager' ? 'info' : 'default'
                  }
                >
                  {user.role}
                </Badge>
                {user.is_active ? (
                  <Badge variant="success">Aktif</Badge>
                ) : (
                  <Badge variant="muted">Nonaktif</Badge>
                )}
              </div>
            </div>

            <div className="grid gap-3 border-t border-surface-200 pt-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <label className="grid gap-1 text-xs font-medium text-surface-500">
                Role
                <select
                  value={user.role}
                  disabled={isCurrentUser || isPending}
                  onChange={(event) => {
                    const role = event.target.value as UserRole;
                    setUsers((current) =>
                      current.map((item) => (item.id === user.id ? { ...item, role } : item))
                    );
                  }}
                  className="h-9 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm font-medium text-surface-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={`Role ${user.full_name}`}
                >
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </label>

              <label className="flex h-9 items-center gap-2 rounded-lg border border-surface-300 px-3 text-xs font-medium text-surface-600">
                <input
                  type="checkbox"
                  checked={user.is_active}
                  disabled={isCurrentUser || isPending}
                  onChange={(event) => {
                    const is_active = event.target.checked;
                    setUsers((current) =>
                      current.map((item) => (item.id === user.id ? { ...item, is_active } : item))
                    );
                  }}
                  className="h-4 w-4 accent-primary-600"
                  aria-label={`Status aktif ${user.full_name}`}
                />
                Aktif
              </label>

              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={isCurrentUser || isPending}
                onClick={() => saveUser(user)}
                className="inline-flex items-center justify-center gap-1.5"
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : isSaved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                {isSaved ? 'Tersimpan' : 'Simpan'}
              </Button>
            </div>

            {isCurrentUser && <p className="text-xs text-surface-500">Akun admin aktif saat ini.</p>}
          </Card>
        );
      })}

      {error && (
        <p className="text-sm text-danger-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
