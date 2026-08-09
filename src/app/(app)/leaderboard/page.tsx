import { LeaderboardView } from '@/components/leaderboard/LeaderboardView';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function LeaderboardPage() {
  const profile = await requirePermission('leaderboard');
  const supabase = await createClient();

  let branchIds: string[] = [];
  if (profile.role === 'admin') {
    const { data } = await supabase.from('branch').select('id').eq('is_active', true);
    branchIds = (data ?? []).map((b) => b.id);
  } else {
    const { data } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    branchIds = (data ?? []).map((x) => x.branch_id);
  }

  const { data: branches } = await supabase
    .from('branch')
    .select('id, name')
    .in('id', branchIds)
    .order('name');

  const { data: outlets } = await supabase
    .from('outlet')
    .select('id, branch_id, name')
    .eq('is_active', true)
    .in('branch_id', branchIds)
    .order('name');

  const { data: periods } = await supabase
    .from('period')
    .select('id, label, status')
    .order('start_date', { ascending: false })
    .limit(24);

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Leaderboard</h1>
        <p className="mt-0.5 text-sm text-surface-500">Ranking performa kasir</p>
        <div className="mt-4">
            <LeaderboardView
            branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))}
            outlets={(outlets ?? []).map((o) => ({
              id: o.id,
              name: o.name,
              branch_id: o.branch_id,
            }))}
            periods={(periods ?? []).map((period) => ({
              id: period.id,
              label: period.label,
              status: period.status,
            }))}
          />
        </div>
    </div>
  );
}
