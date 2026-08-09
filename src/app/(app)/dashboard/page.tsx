import Link from 'next/link';
import { Trophy, ClipboardCheck, Sliders, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { requireUser } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  const isAdmin = profile.role === 'admin';
  const userId = profile.id;
  const permissions = await getRolePermissions(profile.role);
  const canAssessment = hasPermission(permissions, 'assessment');
  const canLeaderboard = hasPermission(permissions, 'leaderboard');
  const canMentoring = hasPermission(permissions, 'mentoring');
  const canCashiers = hasPermission(permissions, 'cashiers.view');

  // Ambil periode aktif
  const { data: currentPeriod } = await supabase
    .from('period')
    .select('*')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Ambil cabang akses user
  let branchIds: string[] = [];
  if (isAdmin) {
    const { data: branches } = await supabase.from('branch').select('id').eq('is_active', true);
    branchIds = (branches ?? []).map((b) => b.id);
  } else {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', userId);
    branchIds = (ub ?? []).map((x) => x.branch_id);
  }

  // Hitung jumlah kasir di cabang akses
  const { count: cashierCount } = await supabase
    .from('cashier')
    .select('*, outlet!inner(branch_id)', { count: 'exact', head: true })
    .eq('is_active', true)
    .in('outlet.branch_id', branchIds);

  // Jumlah kasir sudah dinilai di periode berjalan
  let assessedCount = 0;
  if (currentPeriod && branchIds.length > 0) {
    const { count } = await supabase
      .from('assessment')
      .select('*, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
      .eq('period_id', currentPeriod.id)
      .in('cashier.outlet.branch_id', branchIds);
    assessedCount = count ?? 0;
  }

  const name = profile.full_name.split(' ')[0];

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Halo, {name}</h1>
        <p className="mt-0.5 text-sm text-surface-500">
          {isAdmin ? 'Administrator' : profile.role === 'manager' ? 'Manager' : 'Supervisor'}
          {currentPeriod ? ` · Periode ${formatDate(currentPeriod.start_date)}` : ''}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {(canCashiers || canAssessment) && (
            <Card>
              <CardTitle>Kasir Aktif</CardTitle>
              <p className="mt-1 text-2xl font-bold text-primary-600">{cashierCount ?? 0}</p>
              <Link
                href={canCashiers ? '/cashiers' : '/assessment'}
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
              >
                {canCashiers ? (isAdmin ? 'Lihat semua' : 'Lihat kasir cabang') : 'Lihat penilaian'}{' '}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Card>
          )}
          {canAssessment && (
            <Card>
              <CardTitle>Dinilai</CardTitle>
              <p className="mt-1 text-2xl font-bold text-success-600">{assessedCount}</p>
              <Link
                href="/assessment"
                className="mt-2 inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
              >
                Mulai menilai <ArrowRight className="h-3 w-3" />
              </Link>
            </Card>
          )}
        </div>

        <Card className="mt-4">
          <CardHeader>
            <CardTitle>
              Periode {currentPeriod ? formatDate(currentPeriod.start_date) : 'Berjalan'}
            </CardTitle>
            {currentPeriod && <Badge variant="success">Aktif</Badge>}
          </CardHeader>
          <div className="space-y-2 text-sm">
            {canLeaderboard && (
              <Link
                href="/leaderboard"
                className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
              >
                <div className="flex items-center gap-2.5">
                  <Trophy className="h-4 w-4 text-amber-600" />
                  <span>Lihat Leaderboard Periode</span>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </Link>
            )}
            {canMentoring && (
              <Link
                href="/mentoring"
                className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="h-4 w-4 text-primary-600" />
                  <span>Sesi Pendampingan</span>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/settings/categories"
                className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
              >
                <div className="flex items-center gap-2.5">
                  <Sliders className="h-4 w-4 text-purple-600" />
                  <span>Konfigurasi Penilaian</span>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </Link>
            )}
          </div>
        </Card>
    </div>
  );
}
