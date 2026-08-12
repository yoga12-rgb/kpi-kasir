import { InviteTabClient } from '@/components/settings/InviteTabClient';
import { RolePermissionSettings } from '@/components/settings/RolePermissionSettings';
import { UserSettingsTabs } from '@/components/settings/UserSettingsTabs';
import { UserListClient } from '@/components/settings/UserListClient';
import { requireRole } from '@/lib/auth/guards';
import { parsePage } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { queryUsers } from '@/lib/server/list-queries';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string; tab?: string }>;
}) {
  const admin = await requireRole(['admin']);
  const supabase = await createClient();
  const params = await searchParams;
  const search = params?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(params?.page);
  const pageSize = 25;
  const usersQuery = await queryUsers(supabase, { page, pageSize, search });
  const { data: users, count: userCount } = await usersQuery;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const initialUsers = (users ?? []).map((user) => ({
    ...user,
    created_label: formatDate(user.created_at),
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
            <UserListClient
              currentUserId={admin.id}
              initialResult={{
                items: initialUsers,
                page,
                pageSize,
                total: userCount ?? 0,
                totalPages: Math.max(1, Math.ceil((userCount ?? 0) / pageSize)),
              }}
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
            <InviteTabClient appUrl={appUrl} />
          </div>
        }
      />
    </div>
  );
}
