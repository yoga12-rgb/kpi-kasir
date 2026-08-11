import { MentoringForm } from '@/components/mentoring/MentoringForm';
import { requirePermission } from '@/lib/auth/guards';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { createClient } from '@/lib/supabase/server';

export default async function NewMentoringPage() {
  const profile = await requirePermission('mentoring');
  const supabase = await createClient();

  const branchIds =
    profile.role === 'admin'
      ? null
      : (
          await supabase
            .from('user_branch')
            .select('branch_id')
            .eq('user_id', profile.id)
        ).data?.map((assignment) => assignment.branch_id) ?? [];

  const outletQuery = supabase
    .from('outlet')
    .select('id, name, cashier(id, name, avatar_url), branch!inner(is_active)')
    .eq('is_active', true)
    .order('name');
  const { data: outlets } = branchIds === null
    ? await outletQuery.eq('branch.is_active', true)
    : branchIds.length > 0
      ? await outletQuery.in('branch_id', branchIds)
      : { data: [] };

  // Hitung URL avatar secara batch agar daftar form tidak memicu N+1 request storage.
  const allAvatarPaths = (outlets ?? []).flatMap((outlet) =>
    (outlet.cashier ?? []).map((cashier: { avatar_url: string | null }) => cashier.avatar_url)
  );
  const avatarMap = await getCashierAvatarUrls(supabase, allAvatarPaths);

  const avatars: Record<string, string | null> = {};
  for (const outlet of outlets ?? []) {
    for (const cashier of (outlet.cashier ?? []) as { id: string; avatar_url: string | null }[]) {
      avatars[cashier.id] = cashier.avatar_url ? (avatarMap.get(cashier.avatar_url) ?? null) : null;
    }
  }

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Sesi Pendampingan Baru</h1>
        <p className="mt-0.5 text-sm text-surface-500">Catat kunjungan lapangan</p>
        <div className="mt-6">
          <MentoringForm
            outlets={(outlets ?? []).map((outlet) => ({
              id: outlet.id,
              name: outlet.name,
              cashiers: (outlet.cashier ?? []).map((cashier: { id: string; name: string }) => ({
                id: cashier.id,
                name: cashier.name,
              })),
            }))}
            avatars={avatars}
            evidenceUploadEnabled={process.env.MENTORING_EVIDENCE_UPLOAD_ENABLED === 'true'}
          />
        </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
