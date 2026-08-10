import { InviteForm } from '@/components/invite/InviteForm';
import { InviteList } from '@/components/invite/InviteList';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Search } from 'lucide-react';
import { RolePermissionSettings } from '@/components/settings/RolePermissionSettings';
import { UserSettingsTabs } from '@/components/settings/UserSettingsTabs';
import { UserManagementList } from '@/components/settings/UserManagementList';
import { requireRole } from '@/lib/auth/guards';
import { listInvites } from '@/lib/invites';
import { escapeIlike, getPageRange, getTotalPages, parsePage } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const admin = await requireRole(['admin']);
  const supabase = await createClient();
  const params = await searchParams;
  const search = params?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(params?.page);
  const pageSize = 25;
  const { from, to } = getPageRange(page, pageSize);

  let usersQuery = supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (search) {
    const escaped = escapeIlike(search);
    usersQuery = usersQuery.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }
  const [{ data: users, count: userCount }, { data: branches }, { invites, nextCursor: invitesNextCursor }] =
    await Promise.all([
      usersQuery,
      supabase.from('branch').select('id, name, is_active').order('name'),
      listInvites({ limit: 20 }),
    ]);

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
            <form method="get" className="mb-3 flex items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-medium text-surface-500">
                Cari pengguna
                <input
                  name="q"
                  defaultValue={search}
                  maxLength={100}
                  placeholder="Nama atau email"
                  className="input mt-1"
                />
              </label>
              <button type="submit" className="btn btn-secondary h-10 w-10 px-0" aria-label="Cari pengguna" title="Cari">
                <Search className="mx-auto h-4 w-4" />
              </button>
            </form>
            <UserManagementList
              currentUserId={admin.id}
              initialUsers={(users ?? []).map((user) => ({
                ...user,
                created_label: formatDate(user.created_at),
              }))}
            />
            <PaginationControls
              pathname="/settings/users"
              params={{ q: search || undefined }}
              page={page}
              totalPages={getTotalPages(userCount, pageSize)}
            />
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
            <InviteList
              invites={inviteList}
              nextCursor={invitesNextCursor}
              branches={allBranches.map((branch) => ({ id: branch.id, name: branch.name }))}
              appUrl={appUrl}
            />
          </div>
        }
      />
    </div>
  );
}
