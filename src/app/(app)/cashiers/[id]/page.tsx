import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { CalendarDays, MapPin } from 'lucide-react';
import { BackLink } from '@/components/navigation/BackLink';
import { Card } from '@/components/ui/Card';
import { CashierAvatarForm } from '@/components/cashiers/CashierAvatarForm';
import { CashierDetailTabs } from '@/components/cashiers/CashierDetailTabs';
import { CashierNameEditForm } from '@/components/cashiers/CashierNameEditForm';
import { CashierStatusButton } from '@/components/cashiers/CashierStatusButton';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrl } from '@/lib/storage/cashier-avatar';
import { getSafeReturnTo, withReturnTo } from '@/lib/navigation';
import { formatDate, formatEmploymentDuration, formatScore } from '@/lib/utils';

export default async function CashierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const profile = await requirePermission('cashiers.view');
  const [permissions, { id }, navigationParams] = await Promise.all([
    getRolePermissions(profile.role),
    params,
    searchParams,
  ]);
  const backHref = getSafeReturnTo(navigationParams?.returnTo, '/cashiers');
  const canAssess = profile.role === 'admin' || hasPermission(permissions, 'assessment');
  const canMentor = profile.role === 'admin' || hasPermission(permissions, 'mentoring');
  const canEditCashier = profile.role === 'admin';
  const canEditCashierName =
    profile.role === 'admin' || hasPermission(permissions, 'cashiers.update');
  const canViewPhoto =
    profile.role === 'admin' || hasPermission(permissions, 'cashier_photos.view');
  const canUploadPhoto =
    profile.role === 'admin' ||
    hasPermission(permissions, 'cashier_photos.create') ||
    hasPermission(permissions, 'cashier_photos.update');
  const supabase = await createClient();

  const [cashierResult, currentPeriodResult, branchAccessResult] = await Promise.all([
    supabase
      .from('cashier')
      .select(
        'id, name, avatar_url, is_active, employment_start_date, outlet_id, outlet(id, name, branch_id, branch(id, name))'
      )
      .eq('id', id)
      .single(),
    supabase
      .from('period')
      .select('id, start_date')
      .eq('status', 'open')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    profile.role === 'admin'
      ? Promise.resolve({ data: [] as { branch_id: string }[] })
      : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id),
  ]);
  const cashier = cashierResult.data;

  if (!cashier) notFound();

  const outlet = cashier.outlet as unknown as {
    branch_id: string;
    name: string;
    branch: { name: string };
  };

  // Cek akses non-admin.
  if (profile.role !== 'admin') {
    const allowed = ((branchAccessResult.data ?? []) as { branch_id: string }[]).map(
      (assignment) => assignment.branch_id
    );
    if (!allowed.includes(outlet.branch_id)) redirect('/dashboard');
  }

  const currentPeriod = currentPeriodResult.data;
  const [avatarUrl, periodScoreResult] = await Promise.all([
    canViewPhoto ? getCashierAvatarUrl(supabase, cashier.avatar_url) : Promise.resolve(null),
    currentPeriod
      ? supabase
          .from('cashier_period_score')
          .select('total_score, category_scores')
          .eq('period_id', currentPeriod.id)
          .eq('cashier_id', cashier.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const periodScore = periodScoreResult.data;

  const categoryScores = (periodScore?.category_scores ?? {}) as Record<
    string,
    { name: string; score: number }
  >;

  return (
    <div className="p-4">
      <BackLink href={backHref} label="Kasir" />

      <Card className="mt-4 overflow-hidden border-primary-500/20 p-0 shadow-none">
        <div className="px-5 pb-6 pt-6 text-center sm:px-8 sm:pb-7 sm:pt-7">
          <div className="relative mb-5 flex min-h-4 items-center justify-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-surface-500">
              Profil Kasir
            </p>
            <div className="absolute left-0 top-1/2 -translate-y-1/2">
              <CashierStatusButton
                cashierId={cashier.id}
                cashierName={cashier.name}
                outletName={outlet?.name ?? '-'}
                isActive={cashier.is_active}
                canManageStatus={profile.role === 'admin'}
              />
            </div>
          </div>
          <CashierAvatarForm
            cashierId={cashier.id}
            name={cashier.name}
            avatarUrl={avatarUrl}
            canUpload={canUploadPhoto}
            avatarSize={136}
            details={
              <div className="mt-4 w-full text-center">
                <CashierNameEditForm
                  cashierId={cashier.id}
                  name={cashier.name}
                  canEdit={canEditCashierName}
                />
                <div className="mx-auto mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-surface-400">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 text-primary-500" />
                    Mulai {formatDate(cashier.employment_start_date)}
                  </span>
                  <span aria-hidden="true">&middot;</span>
                  <span>Masa kerja {formatEmploymentDuration(cashier.employment_start_date)}</span>
                </div>
                <div className="mx-auto mt-2 flex max-w-xs items-start justify-center gap-1.5 text-sm leading-5 text-surface-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                  <span>
                    {outlet?.branch?.name} &middot; {outlet?.name}
                  </span>
                </div>
              </div>
            }
          />
        </div>

        {canAssess && (
          <div className="border-t border-surface-200 bg-surface-100/40 px-5 py-5 sm:px-8">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-surface-500">
                  Skor Periode
                </p>
                <p className="mt-1 text-xs text-surface-400">
                  {currentPeriod ? formatDate(currentPeriod.start_date) : 'Berjalan'}
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-primary-600">
                  {formatScore(periodScore?.total_score ?? null)}
                </p>
              </div>
              <Link
                href={withReturnTo(`/assessment/${cashier.id}`, `/cashiers/${cashier.id}`)}
                className="btn btn-primary btn-sm shrink-0"
              >
                Nilai
              </Link>
            </div>

            {Object.keys(categoryScores).length > 0 && (
              <div className="mt-4 divide-y divide-surface-200 border-t border-surface-200 pt-2">
                {Object.values(categoryScores).map((cs) => (
                  <div
                    key={cs.name}
                    className="flex items-center justify-between gap-4 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-surface-600">{cs.name}</span>
                    <span className="shrink-0 font-semibold text-surface-800">
                      {formatScore(cs.score)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      <CashierDetailTabs
        key={`${cashier.id}:${cashier.outlet_id}:${cashier.is_active}`}
        cashierId={cashier.id}
        currentOutletId={cashier.outlet_id}
        canManageMutation={canEditCashier && cashier.is_active}
        canMentor={canMentor}
        canViewStatusHistory={profile.role === 'admin'}
      />
    </div>
  );
}
