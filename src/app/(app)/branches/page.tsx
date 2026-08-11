import { BranchListClient, type BranchListItem } from '@/components/branches/BranchListClient';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getTotalPages, parsePage } from '@/lib/pagination';
import { queryBranches } from '@/lib/server/list-queries';

export default async function BranchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requirePermission('branches.view');
  const supabase = await createClient();
  const params = await searchParams;
  const search = params?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(params?.page);
  const pageSize = 25;
  const query = await queryBranches(supabase, {
    actor: profile,
    page,
    pageSize,
    search,
  });

  const { data: branches, count } = await query;
  const initialItems: BranchListItem[] = (branches ?? []).map((branch) => ({
    id: branch.id,
    name: branch.name,
    code: branch.code,
    isActive: branch.is_active,
    outletCount: branch.outlet?.[0]?.count ?? 0,
  }));
  const total = count ?? 0;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Cabang</h1>
          <p className="mt-0.5 text-sm text-surface-500">
            {profile.role === 'admin' ? 'Kelola struktur cabang' : 'Cabang yang ditugaskan'}
          </p>
        </div>
      </div>

      <BranchListClient
        initialResult={{
          items: initialItems,
          page,
          pageSize,
          total,
          totalPages: getTotalPages(total, pageSize),
        }}
        canCreate={profile.role === 'admin'}
      />
    </div>
  );
}
