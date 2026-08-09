import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { InviteForm } from '@/components/invite/InviteForm';
import { InviteList } from '@/components/invite/InviteList';
import { RolePermissionSettings } from '@/components/settings/RolePermissionSettings';
import { UserSettingsTabs } from '@/components/settings/UserSettingsTabs';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requireRole(['admin']);
  const supabase = await createClient();

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: branches } = await supabase
    .from('branch')
    .select('id, name, is_active')
    .order('name');

  const { data: invites } = await supabase
    .from('invite')
    .select('*')
    .order('created_at', { ascending: false });

  const allBranches = branches ?? [];
  const activeBranches = allBranches.filter((branch) => branch.is_active !== false);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const inviteList = (invites ?? []).map((invite) => ({
    ...invite,
    link: `${appUrl}/invite/${invite.token}`,
    branchNames: allBranches
      .filter((branch) => invite.branch_ids.includes(branch.id))
      .map((branch) => branch.name),
  }));

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-surface-900">Akun Pengguna</h1>
      <p className="mt-0.5 text-sm text-surface-500">Kelola akun, hak akses, dan undangan</p>

      <UserSettingsTabs
        userList={
          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-surface-900">Daftar Pengguna</h2>
              <p className="mt-0.5 text-xs text-surface-500">Akun yang terdaftar di aplikasi.</p>
            </div>
            <div className="space-y-2">
              {(users ?? []).map((u) => (
                <Card key={u.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-surface-900">{u.full_name}</p>
                    <p className="truncate text-sm text-surface-500">{u.email}</p>
                    <p className="text-xs text-surface-400">Bergabung {formatDate(u.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant={
                        u.role === 'admin' ? 'danger' : u.role === 'manager' ? 'info' : 'default'
                      }
                    >
                      {u.role}
                    </Badge>
                    {u.is_active ? (
                      <Badge variant="success">Aktif</Badge>
                    ) : (
                      <Badge variant="muted">Nonaktif</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        }
        rolePermissions={
          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-surface-900">Hak Akses Role</h2>
              <p className="mt-0.5 text-xs text-surface-500">
                Atur fitur yang dapat digunakan setiap role.
              </p>
            </div>
            <RolePermissionSettings />
          </div>
        }
        invite={
          <div>
            <div className="mb-3">
              <h2 className="text-lg font-semibold text-surface-900">Undang Pengguna</h2>
              <p className="mt-0.5 text-xs text-surface-500">
                Buat link undangan untuk manager atau supervisor.
              </p>
            </div>
            <InviteForm branches={activeBranches.map((b) => ({ id: b.id, name: b.name }))} />
            <InviteList invites={inviteList} />
          </div>
        }
      />
    </div>
  );
}
