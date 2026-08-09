import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { formatDate, formatEmploymentDuration } from '@/lib/utils';

export default async function CashiersPage() {
  const profile = await requirePermission('cashiers.view');
  const supabase = await createClient();
  const isAdmin = profile.role === 'admin';

  let query = supabase
    .from('cashier')
    .select('*, outlet!inner(name, branch(name))')
    .eq('is_active', true)
    .order('name');

  // Non-admin: filter ke cabang yang ditugaskan
  if (!isAdmin) {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    const branchIds = (ub ?? []).map((x) => x.branch_id);
    query = query.in('outlet.branch_id', branchIds);
  }

  const { data: cashiers } = await query;

  const avatarMap = await getCashierAvatarUrls(
    supabase,
    (cashiers ?? []).map((c) => c.avatar_url)
  );

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Kasir</h1>
          <p className="mt-0.5 text-sm text-surface-500">
            {isAdmin ? 'Semua kasir aktif' : 'Kasir pada cabang yang ditugaskan'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {(cashiers ?? []).map((cashier) => {
          const outlet = cashier.outlet as unknown as { name: string; branch: { name: string } };
          return (
            <Link key={cashier.id} href={`/cashiers/${cashier.id}`} className="block">
              <Card className="flex items-center gap-3 transition-colors hover:bg-surface-100">
                <CashierAvatar
                  name={cashier.name}
                  src={cashier.avatar_url ? (avatarMap.get(cashier.avatar_url) ?? null) : null}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-surface-900">{cashier.name}</p>
                  <p className="mt-0.5 text-xs text-surface-400">
                    Mulai {formatDate(cashier.employment_start_date)} &middot;{' '}
                    {formatEmploymentDuration(cashier.employment_start_date)}
                  </p>
                  <p className="truncate text-sm text-surface-500">
                    {outlet?.branch?.name} · {outlet?.name}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-surface-400" />
              </Card>
            </Link>
          );
        })}
        {(cashiers ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-surface-500">Belum ada kasir.</p>
        )}
      </div>
    </div>
  );
}
