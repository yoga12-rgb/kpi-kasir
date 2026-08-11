import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';

export const dynamic = 'force-dynamic';

export default async function AssessmentPage() {
  const profile = await requirePermission('assessment');
  const supabase = await createClient();

  const periodPromise = supabase
    .from('period')
    .select('id, label')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const branchScopePromise =
    profile.role === 'admin'
      ? supabase.from('branch').select('id').eq('is_active', true)
      : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id);
  const [periodResult, branchScopeResult] = await Promise.all([periodPromise, branchScopePromise]);
  const period = periodResult.data;
  const branchIds =
    profile.role === 'admin'
      ? ((branchScopeResult.data ?? []) as { id: string }[]).map((branch) => branch.id)
      : ((branchScopeResult.data ?? []) as { branch_id: string }[]).map(
          (assignment) => assignment.branch_id
        );

  const { data: cashiers } = await supabase
    .from('cashier')
    .select('id, name, avatar_url, outlet!inner(branch_id, name, branch(id, name, code))')
    .eq('is_active', true)
    .in('outlet.branch_id', branchIds)
    .order('name');

  const cashierIds = (cashiers ?? []).map((cashier) => cashier.id);
  const [scoresResult, completionsResult, avatarMap] = await Promise.all([
    period && cashierIds.length > 0
      ? supabase
          .from('cashier_period_score')
          .select('cashier_id, total_score')
          .eq('period_id', period.id)
          .in('cashier_id', cashierIds)
      : Promise.resolve({ data: [] }),
    period && cashierIds.length > 0
      ? supabase
          .from('cashier_period_completion')
          .select('cashier_id, status, assessed_details, total_details')
          .eq('period_id', period.id)
          .in('cashier_id', cashierIds)
      : Promise.resolve({ data: [] }),
    getCashierAvatarUrls(
      supabase,
      (cashiers ?? []).map((cashier) => cashier.avatar_url)
    ),
  ]);
  const scores = scoresResult.data;
  const completions = completionsResult.data;

  const scoreMap = new Map((scores ?? []).map((s) => [s.cashier_id, Number(s.total_score)]));
  const completionMap = new Map((completions ?? []).map((c) => [c.cashier_id, c]));

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Penilaian</h1>
        <p className="mt-0.5 text-sm text-surface-500">
          {period ? `Periode berjalan · ${period.label}` : 'Tidak ada periode aktif'}
        </p>

        <div className="mt-4 space-y-2">
          {(cashiers ?? []).map((cashier) => {
            const outlet = cashier.outlet as unknown as {
              name?: string;
              branch?: { id?: string; name?: string; code?: string | null };
            };
            const outletName = outlet?.name ?? '-';
            const branchCode = outlet?.branch?.code;
            const branchName = outlet?.branch?.name;
            const score = scoreMap.get(cashier.id);
            const completion = completionMap.get(cashier.id);
            const completionStatus = completion?.status ?? 'not_started';
            const completionLabel =
              completionStatus === 'complete'
                ? 'Selesai'
                : completionStatus === 'in_progress'
                  ? `Berjalan ${completion?.assessed_details ?? 0}/${completion?.total_details ?? 0}`
                  : 'Belum mulai';
            return (
              <Link key={cashier.id} href={`/assessment/${cashier.id}`} className="block">
                <Card className="flex items-center gap-3 transition-colors hover:bg-surface-100">
                  <CashierAvatar
                    name={cashier.name}
                    src={cashier.avatar_url ? (avatarMap.get(cashier.avatar_url) ?? null) : null}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-surface-900">{cashier.name}</p>
                      {branchCode && (
                        <span className="rounded-md bg-surface-200/80 px-1.5 py-0.5 text-xs font-semibold text-surface-700">
                          {branchCode}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-surface-500">
                      {branchName ? `${branchName} · ` : ''}
                      {outletName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <Badge
                        variant={
                          completionStatus === 'complete'
                            ? 'success'
                            : completionStatus === 'in_progress'
                              ? 'warning'
                              : 'muted'
                        }
                      >
                        {completionLabel}
                      </Badge>
                      <p className="mt-1 text-xs text-surface-500">
                        Skor {score !== undefined ? score.toFixed(1) : '0.0'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-400" />
                  </div>
                </Card>
              </Link>
            );
          })}
          {(cashiers ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-surface-500">
              Tidak ada kasir pada cabang yang kamu kelola.
            </p>
          )}
        </div>
    </div>
  );
}
