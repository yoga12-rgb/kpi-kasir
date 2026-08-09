import Link from 'next/link';
import { Plus } from 'lucide-react';
import { MentoringList } from '@/components/mentoring/MentoringList';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function MentoringPage() {
  const profile = await requirePermission('mentoring');
  const supabase = await createClient();

  let branchIds: string[] = [];
  let branches: { id: string; name: string }[] = [];

  if (profile.role === 'admin') {
    const { data } = await supabase
      .from('branch')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    branches = data ?? [];
    branchIds = branches.map((branch) => branch.id);
  } else {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    branchIds = (userBranches ?? []).map((branch) => branch.branch_id);

    if (branchIds.length > 0) {
      const { data } = await supabase
        .from('branch')
        .select('id, name')
        .eq('is_active', true)
        .in('id', branchIds)
        .order('name');
      branches = data ?? [];
    }
  }

  const { data: outlets } =
    branchIds.length > 0
      ? await supabase
          .from('outlet')
          .select('id, name, branch_id')
          .eq('is_active', true)
          .in('branch_id', branchIds)
          .order('name')
      : { data: [] };

  return (
    <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900">Pendampingan</h1>
            <p className="mt-0.5 text-sm text-surface-500">Riwayat kunjungan lapangan</p>
          </div>
          <Link href="/mentoring/new" className="btn btn-primary flex items-center gap-1">
            <Plus className="h-4 w-4" />
            <span>Sesi</span>
          </Link>
        </div>

        <div className="mt-4">
          <MentoringList
            branches={branches}
            outlets={(outlets ?? []).map((outlet) => ({
              id: outlet.id,
              name: outlet.name,
              branch_id: outlet.branch_id,
            }))}
          />
        </div>
    </div>
  );
}
