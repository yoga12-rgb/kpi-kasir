import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MentoringList } from '@/components/mentoring/MentoringList';
import { requirePermission } from '@/lib/auth/guards';
import { buildPath, withReturnTo } from '@/lib/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function MentoringPage({
  searchParams,
}: {
  searchParams?: Promise<{ branchId?: string; outletId?: string; from?: string; to?: string }>;
}) {
  const profile = await requirePermission('mentoring');
  const supabase = await createClient();
  const params = await searchParams;
  const returnTo = buildPath('/mentoring', {
    branchId: params?.branchId,
    outletId: params?.outletId,
    from: params?.from,
    to: params?.to,
  });

  if (profile.role === 'admin') {
    const [branchesResult, outletsResult] = await Promise.all([
      supabase.from('branch').select('id, name').eq('is_active', true).order('name'),
      supabase
        .from('outlet')
        .select('id, name, branch_id, branch!inner(is_active)')
        .eq('is_active', true)
        .eq('branch.is_active', true)
        .order('name'),
    ]);

    return (
      <MentoringPageContent
        branches={branchesResult.data ?? []}
        outlets={outletsResult.data ?? []}
        returnTo={returnTo}
      />
    );
  }

  const { data: userBranches } = await supabase
    .from('user_branch')
    .select('branch_id')
    .eq('user_id', profile.id);
  const branchIds = (userBranches ?? []).map((branch) => branch.branch_id);
  const [branchesResult, outletsResult] = await Promise.all([
    branchIds.length > 0
      ? supabase
          .from('branch')
          .select('id, name')
          .eq('is_active', true)
          .in('id', branchIds)
          .order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    branchIds.length > 0
      ? supabase
          .from('outlet')
          .select('id, name, branch_id')
          .eq('is_active', true)
          .in('branch_id', branchIds)
          .order('name')
      : Promise.resolve({ data: [] as { id: string; name: string; branch_id: string }[] }),
  ]);

  return (
    <MentoringPageContent
      branches={branchesResult.data ?? []}
      outlets={outletsResult.data ?? []}
      returnTo={returnTo}
    />
  );
}

function MentoringPageContent({
  branches,
  outlets,
  returnTo,
}: {
  branches: { id: string; name: string }[];
  outlets: { id: string; name: string; branch_id: string }[];
  returnTo: string;
}) {
  return (
    <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900">Pendampingan</h1>
            <p className="mt-0.5 text-sm text-surface-500">Riwayat kunjungan lapangan</p>
          </div>
          <Link
            href={withReturnTo('/mentoring/new', returnTo)}
            className="btn btn-primary flex items-center gap-1"
          >
            <Plus className="h-4 w-4" />
            <span>Sesi</span>
          </Link>
        </div>

        <div className="mt-4">
          <MentoringList
            branches={branches}
            outlets={outlets.map((outlet) => ({
              id: outlet.id,
              name: outlet.name,
              branch_id: outlet.branch_id,
            }))}
          />
        </div>
    </div>
  );
}
