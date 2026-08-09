import { MentoringForm } from '@/components/mentoring/MentoringForm';
import { requirePermission } from '@/lib/auth/guards';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { createClient } from '@/lib/supabase/server';

export default async function NewMentoringPage() {
  const profile = await requirePermission('mentoring');
  const supabase = await createClient();

  let branchIds: string[] = [];
  if (profile.role === 'admin') {
    const { data: branches } = await supabase.from('branch').select('id').eq('is_active', true);
    branchIds = (branches ?? []).map((b) => b.id);
  } else {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    branchIds = (ub ?? []).map((x) => x.branch_id);
  }

  const { data: outlets } = await supabase
    .from('outlet')
    .select('id, name, cashier(id, name, avatar_url)')
    .eq('is_active', true)
    .in('branch_id', branchIds)
    .order('name');

  // Hitung signed URLs untuk semua avatar kasir (sekali batch)
  const allAvatarPaths = (outlets ?? []).flatMap((o) =>
    (o.cashier ?? []).map((c: { avatar_url: string | null }) => c.avatar_url)
  );
  const avatarMap = await getCashierAvatarUrls(supabase, allAvatarPaths);

  const avatars: Record<string, string | null> = {};
  for (const o of outlets ?? []) {
    for (const c of (o.cashier ?? []) as { id: string; avatar_url: string | null }[]) {
      avatars[c.id] = c.avatar_url ? (avatarMap.get(c.avatar_url) ?? null) : null;
    }
  }

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Sesi Pendampingan Baru</h1>
        <p className="mt-0.5 text-sm text-surface-500">Catat kunjungan lapangan</p>
        <div className="mt-6">
          <MentoringForm
            outlets={(outlets ?? []).map((o) => ({
              id: o.id,
              name: o.name,
              cashiers: (o.cashier ?? []).map((c: { id: string; name: string }) => ({
                id: c.id,
                name: c.name,
              })),
            }))}
            avatars={avatars}
          />
        </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
