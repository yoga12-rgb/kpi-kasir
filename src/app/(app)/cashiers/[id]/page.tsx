import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TransferForm } from '@/components/cashiers/TransferForm';
import { CashierAvatarForm } from '@/components/cashiers/CashierAvatarForm';
import { CashierDetailTabs } from '@/components/cashiers/CashierDetailTabs';
import { CashierNameEditForm } from '@/components/cashiers/CashierNameEditForm';
import { CashierStatusButton } from '@/components/cashiers/CashierStatusButton';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrl } from '@/lib/storage/cashier-avatar';
import { formatDate, formatEmploymentDuration, formatScore } from '@/lib/utils';

export default async function CashierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('cashiers.view');
  const permissions = await getRolePermissions(profile.role);
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
  const { id } = await params;
  const supabase = await createClient();

  const { data: cashier } = await supabase
    .from('cashier')
    .select('id, name, avatar_url, is_active, employment_start_date, outlet_id, outlet(id, name, branch_id, branch(id, name))')
    .eq('id', id)
    .single();

  if (!cashier) notFound();

  const avatarUrl = canViewPhoto ? await getCashierAvatarUrl(supabase, cashier.avatar_url) : null;

  const outlet = cashier.outlet as unknown as {
    branch_id: string;
    name: string;
    branch: { name: string };
  };

  // Cek akses non-admin
  if (profile.role !== 'admin') {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    const allowed = (ub ?? []).map((x) => x.branch_id);
    if (!allowed.includes(outlet.branch_id)) redirect('/dashboard');
  }

  // Skor periode berjalan
  const { data: currentPeriod } = await supabase
    .from('period')
    .select('id, start_date')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: periodScore } = currentPeriod
      ? await supabase
          .from('cashier_period_score')
        .select('total_score, category_scores')
        .eq('period_id', currentPeriod.id)
        .eq('cashier_id', cashier.id)
        .maybeSingle()
    : { data: null };

  // Riwayat penempatan
  const { data: histories } = await supabase
    .from('cashier_outlet_history')
    .select('id, started_at, ended_at, outlet(name)')
    .eq('cashier_id', cashier.id)
    .order('started_at', { ascending: false });

  const { data: statusHistories } =
    profile.role === 'admin'
      ? await supabase
          .from('cashier_status_history')
          .select('id, is_active, effective_at, reason, changed_by(full_name)')
          .eq('cashier_id', cashier.id)
          .order('effective_at', { ascending: false })
      : { data: [] };

  // Riwayat pendampingan (dari mentoring_cashier_note)
  const { data: mentoringNotes } = canMentor
    ? await supabase
        .from('mentoring_cashier_note')
        .select(
          '*, mentoring_session!inner(outlet(name), visited_date, note_outlet, conducted_by(full_name))'
        )
        .eq('cashier_id', cashier.id)
        .order('mentoring_session(visited_date)', { ascending: false })
    : { data: [] };

  // Outlet untuk mutasi (dalam cabang akses)
  let outlets: { id: string; name: string }[] = [];
  if (profile.role === 'admin') {
    const { data: allOutlets } = await supabase
      .from('outlet')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    outlets = allOutlets ?? [];
  }

  const categoryScores = (periodScore?.category_scores ?? {}) as Record<
    string,
    { name: string; score: number }
  >;

  return (
    <div className="p-4">
      <Link
        href="/cashiers"
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Kasir</span>
      </Link>

      {/* Ringkasan kasir */}
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
                    {outlet?.branch?.name} · {outlet?.name}
                  </span>
                </div>
              </div>
            }
          />
        </div>

        {/* Skor periode */}
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
              <Link href={`/assessment/${cashier.id}`} className="btn btn-primary btn-sm shrink-0">
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
        mutation={
          canEditCashier && cashier.is_active ? (
            <Card className="mt-4">
              <h2 className="mb-3 text-base font-semibold text-surface-900">Mutasi Outlet</h2>
              <TransferForm
                cashierId={cashier.id}
                currentOutletId={cashier.outlet_id}
                outlets={outlets}
              />
            </Card>
          ) : undefined
        }
        placement={
          <Card className="mt-4">
            <h2 className="mb-3 text-base font-semibold text-surface-900">Riwayat Penempatan</h2>
            <div className="space-y-2 text-sm">
              {(histories ?? []).map((h) => {
                const outletName = (h.outlet as unknown as { name: string })?.name ?? '-';
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between border-b border-surface-100 pb-2 last:border-0"
                  >
                    <span className="font-medium text-surface-800">{outletName}</span>
                    <span className="text-xs text-surface-500">
                      {formatDate(h.started_at)}{' '}
                      {h.ended_at ? `- ${formatDate(h.ended_at)}` : '- sekarang'}
                    </span>
                  </div>
                );
              })}
              {(histories ?? []).length === 0 && (
                <p className="text-surface-500">Belum ada riwayat.</p>
              )}
            </div>

            {profile.role === 'admin' && (
              <div className="mt-5 border-t border-surface-200 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-surface-800">Riwayat Status</h3>
                <div className="space-y-2">
                  {(statusHistories ?? []).map((statusHistory) => {
                    const changedBy = statusHistory.changed_by as unknown as {
                      full_name: string;
                    } | null;
                    return (
                      <div
                        key={statusHistory.id}
                        className="rounded-lg border border-surface-100 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-surface-800">
                            {statusHistory.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                          <span className="text-surface-500">
                            {formatDate(statusHistory.effective_at)}
                          </span>
                        </div>
                        <p className="mt-1 text-surface-600">{statusHistory.reason}</p>
                        {changedBy?.full_name && (
                          <p className="mt-1 text-surface-400">oleh {changedBy.full_name}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </Card>
        }
        mentoring={
          canMentor ? (
            <div>
              <Card className="mt-4">
                <h2 className="mb-3 text-base font-semibold text-surface-900">Pendampingan</h2>
                <div className="space-y-3">
                  {(mentoringNotes ?? []).map((note) => {
                    const session = note.mentoring_session as unknown as {
                      visited_date: string;
                      outlet: { name: string };
                      conducted_by: { full_name: string };
                    };
                    return (
                      <div key={note.id} className="border-b border-surface-100 pb-3 last:border-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {session?.outlet?.name ?? 'Outlet'}
                          </span>
                          <span className="text-xs text-surface-500">
                            {formatDate(session?.visited_date)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-surface-600">{note.note}</p>
                        {session?.conducted_by && (
                          <p className="mt-1 text-xs text-surface-400">
                            oleh {session.conducted_by.full_name}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {(mentoringNotes ?? []).length === 0 && (
                    <p className="text-sm text-surface-500">Belum ada pendampingan.</p>
                  )}
                </div>
              </Card>
              <Link href="/mentoring" className="btn btn-primary mt-3 w-full">
                Catat Pendampingan
              </Link>
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
