import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Sliders,
  TrendingDown,
  Trophy,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth/guards';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatScore } from '@/lib/utils';

interface ScoreRow {
  id: string;
  name: string;
  score: number;
}

interface DashboardMetricProps {
  title: string;
  value: string | number | null;
  description: string;
  href?: string;
  icon: typeof Users;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
}

function getDashboardNowIso() {
  return new Date().toISOString();
}

function getThirtyDaysAgoIso() {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function DashboardMetric({
  title,
  value,
  description,
  href,
  icon: Icon,
  tone = 'primary',
}: DashboardMetricProps) {
  const toneClass = {
    primary: 'text-primary-600',
    success: 'text-success-600',
    warning: 'text-amber-600',
    danger: 'text-danger-600',
  }[tone];

  const content = (
    <Card className="h-full">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-surface-500">{title}</p>
          <p className={`mt-1 text-2xl font-bold ${value === null ? 'text-surface-400' : toneClass}`}>
            {value ?? 'Tidak tersedia'}
          </p>
        </div>
        <Icon className={`h-5 w-5 ${toneClass}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs text-surface-500">{description}</p>
      {href && <ArrowRight className="mt-3 h-4 w-4 text-surface-400" aria-hidden="true" />}
    </Card>
  );

  return href ? (
    <Link href={href} className="block transition-transform hover:-translate-y-0.5">
      {content}
    </Link>
  ) : (
    content
  );
}

function ScoreList({ title, rows, emptyLabel }: { title: string; rows: ScoreRow[]; emptyLabel: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <TrendingDown className="h-4 w-4 text-primary-600" aria-hidden="true" />
      </CardHeader>
      {rows.length === 0 ? (
        <p className="text-sm text-surface-500">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/cashiers/${row.id}`}
              className="flex items-center justify-between gap-3 border-b border-surface-200 py-2 last:border-0"
            >
              <span className="truncate text-sm text-surface-700">{row.name}</span>
              <span className="shrink-0 text-sm font-semibold text-primary-600">
                {formatScore(row.score)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function getRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const permissions = await getRolePermissions(profile.role);
  const isAdmin = profile.role === 'admin';
  const canAssessment = hasPermission(permissions, 'assessment');
  const canLeaderboard = hasPermission(permissions, 'leaderboard');
  const canMentoring = hasPermission(permissions, 'mentoring');
  const canCashiers = hasPermission(permissions, 'cashiers.view');
  const canNotifications = hasPermission(permissions, 'notifications');
  const errors: string[] = [];

  const currentPeriodResult = await supabase
    .from('period')
    .select('id, label, start_date, end_date, status')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (currentPeriodResult.error) errors.push('periode aktif');
  const currentPeriod = currentPeriodResult.data;

  let branchIds: string[] = [];
  if (isAdmin) {
    const branchResult = await supabase.from('branch').select('id').eq('is_active', true);
    if (branchResult.error) errors.push('cabang');
    branchIds = (branchResult.data ?? []).map((branch) => branch.id);
  } else {
    const branchResult = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    if (branchResult.error) errors.push('akses cabang');
    branchIds = (branchResult.data ?? []).map((branch) => branch.branch_id);
  }

  const hasBranches = branchIds.length > 0;
  const emptyCount = { count: 0, error: null };

  const cashierCountResult =
    (isAdmin || canCashiers) && hasBranches
      ? await supabase
          .from('cashier')
          .select('id, outlet!inner(branch_id)', { count: 'exact', head: true })
          .eq('is_active', true)
          .in('outlet.branch_id', branchIds)
      : emptyCount;
  if (cashierCountResult.error) errors.push('kasir aktif');

  const completionCompleteResult =
    currentPeriod && hasBranches && (isAdmin || canAssessment || canCashiers)
      ? await supabase
          .from('cashier_period_completion')
          .select('id, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
          .eq('period_id', currentPeriod.id)
          .eq('status', 'complete')
          .in('cashier.outlet.branch_id', branchIds)
      : emptyCount;
  const completionIncompleteResult =
    currentPeriod && hasBranches && (isAdmin || canAssessment || canCashiers)
      ? await supabase
          .from('cashier_period_completion')
          .select('id, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
          .eq('period_id', currentPeriod.id)
          .neq('status', 'complete')
          .in('cashier.outlet.branch_id', branchIds)
      : emptyCount;
  if (completionCompleteResult.error || completionIncompleteResult.error) {
    errors.push('kelengkapan penilaian');
  }

  const scoreQueryEnabled = currentPeriod && hasBranches && (isAdmin || canLeaderboard || canAssessment);
  const createScoreQuery = () =>
    supabase
      .from('cashier_period_score')
      .select('cashier_id, total_score, cashier!inner(id, name, outlet!inner(branch_id))')
      .eq('period_id', currentPeriod?.id ?? '')
      .in('cashier.outlet.branch_id', branchIds);
  const lowScoreResult = scoreQueryEnabled
    ? await supabase
        .from('cashier_period_score')
        .select('id, cashier!inner(outlet!inner(branch_id))', { count: 'exact', head: true })
        .eq('period_id', currentPeriod?.id ?? '')
        .lt('total_score', 70)
        .in('cashier.outlet.branch_id', branchIds)
    : emptyCount;
  const topScoreResult = scoreQueryEnabled
    ? await createScoreQuery().order('total_score', { ascending: false }).limit(3)
    : { data: [], error: null };
  const bottomScoreResult = scoreQueryEnabled
    ? await createScoreQuery().order('total_score', { ascending: true }).limit(3)
    : { data: [], error: null };
  if (lowScoreResult.error || topScoreResult.error || bottomScoreResult.error) {
    errors.push('skor periode');
  }

  const thirtyDaysAgo = getThirtyDaysAgoIso();
  const mentoringResult =
    (isAdmin || canMentoring) && hasBranches
      ? await supabase
          .from('mentoring_session')
          .select('id, outlet!inner(branch_id)', { count: 'exact', head: true })
          .gte('visited_date', thirtyDaysAgo)
          .in('outlet.branch_id', branchIds)
      : emptyCount;
  if (mentoringResult.error) errors.push('pendampingan');

  const unreadResult = isAdmin || canNotifications
    ? await supabase
        .from('notification')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false)
    : emptyCount;
  if (unreadResult.error) errors.push('notifikasi');

  const invitePendingResult = isAdmin
    ? await supabase
        .from('invite')
        .select('id', { count: 'exact', head: true })
        .is('used_at', null)
        .is('revoked_at', null)
        .gt('expires_at', getDashboardNowIso())
    : emptyCount;
  const inviteExpiredResult = isAdmin
    ? await supabase
        .from('invite')
        .select('id', { count: 'exact', head: true })
        .is('used_at', null)
        .is('revoked_at', null)
        .lt('expires_at', getDashboardNowIso())
    : emptyCount;
  if (invitePendingResult.error || inviteExpiredResult.error) errors.push('undangan');

  const configWeightResult = currentPeriod && isAdmin
    ? await supabase
        .from('category_weight_history')
        .select('weight')
        .eq('period_id', currentPeriod.id)
    : { data: [], error: null };
  const configDetailResult = currentPeriod && isAdmin
    ? await supabase
        .from('detail_config_history')
        .select('detail_id', { count: 'exact', head: true })
        .eq('period_id', currentPeriod.id)
    : { count: 0, error: null };
  if (configWeightResult.error || configDetailResult.error) errors.push('konfigurasi periode');

  const completeCount = currentPeriod ? completionCompleteResult.count : null;
  const incompleteCount = currentPeriod ? completionIncompleteResult.count : null;
  const configWeight = (configWeightResult.data ?? []).reduce(
    (total, row) => total + Number(row.weight),
    0
  );
  const configValid =
    isAdmin && currentPeriod
      ? !configWeightResult.error &&
        !configDetailResult.error &&
        Math.abs(configWeight - 100) <= 0.001 &&
        (configDetailResult.count ?? 0) > 0
      : null;
  const closeReady =
    isAdmin && currentPeriod && completeCount !== null && incompleteCount !== null && configValid !== false
      ? configValid !== null
        ? configValid && incompleteCount === 0
        : incompleteCount === 0
      : null;

  function toScoreRows(rows: unknown): ScoreRow[] {
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const item = row as {
        cashier_id?: string;
        total_score?: number;
        cashier?: unknown;
      };
      const cashier = getRelation(item.cashier as { id?: string; name?: string } | { id?: string; name?: string }[]);
      if (!item.cashier_id || !cashier?.name) return [];
      return [{ id: item.cashier_id, name: cashier.name, score: Number(item.total_score ?? 0) }];
    });
  }

  const topScores = toScoreRows(topScoreResult.data);
  const bottomScores = toScoreRows(bottomScoreResult.data);
  const lowScoreCount = lowScoreResult.error ? null : lowScoreResult.count ?? 0;
  const displayName = profile.full_name.split(' ')[0];
  const roleLabel = isAdmin ? 'Administrator' : profile.role === 'manager' ? 'Manager' : 'Supervisor';
  const dashboardHref = canCashiers ? '/cashiers' : canAssessment ? '/assessment' : '/dashboard';

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-surface-900">Halo, {displayName}</h1>
      <p className="mt-0.5 text-sm text-surface-500">
        {roleLabel}
        {currentPeriod ? ` - Periode ${formatDate(currentPeriod.start_date)}` : ''}
      </p>

      {errors.length > 0 && (
        <div className="mt-4 flex items-start gap-2 border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Beberapa data dashboard tidak tersedia. Coba muat ulang halaman.</span>
        </div>
      )}

      {!currentPeriod && (
        <Card className="mt-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2 text-sm text-amber-800">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Belum ada periode penilaian yang aktif.</span>
          </div>
        </Card>
      )}

      {isAdmin ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DashboardMetric
              title="Kesiapan tutup periode"
              value={closeReady === null ? null : closeReady ? 'Siap' : 'Perlu tinjau'}
              description={incompleteCount !== null ? `${incompleteCount} cashier belum lengkap` : 'Status belum tersedia'}
              href="/settings/periods"
              icon={closeReady ? CheckCircle2 : AlertTriangle}
              tone={closeReady ? 'success' : 'warning'}
            />
            <DashboardMetric
              title="Konfigurasi snapshot"
              value={configValid === null ? null : configValid ? 'Valid' : 'Tidak valid'}
              description={configValid === null ? 'Belum tersedia' : `${configWeight.toFixed(1)}% bobot aktif`}
              href="/settings/categories"
              icon={Sliders}
              tone={configValid ? 'success' : 'danger'}
            />
            <DashboardMetric
              title="Kasir aktif"
              value={cashierCountResult.count ?? null}
              description="Dalam cabang aktif"
              href="/cashiers"
              icon={Users}
            />
            <DashboardMetric
              title="Undangan aktif"
              value={invitePendingResult.count ?? null}
              description={inviteExpiredResult.count !== null ? `${inviteExpiredResult.count} sudah kedaluwarsa` : 'Status belum tersedia'}
              href="/settings/users"
              icon={Clock3}
              tone="warning"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <DashboardMetric
              title="Selesai dinilai"
              value={completeCount}
              description={incompleteCount !== null ? `${incompleteCount} belum selesai` : 'Status belum tersedia'}
              href="/assessment"
              icon={ClipboardCheck}
              tone="success"
            />
            <DashboardMetric
              title="Notifikasi belum dibaca"
              value={canNotifications ? unreadResult.count ?? null : null}
              description="Alert dan aktivitas akun"
              href="/notifications"
              icon={Bell}
              tone="primary"
            />
          </div>
        </>
      ) : profile.role === 'manager' ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <DashboardMetric
              title="Progres penilaian"
              value={completeCount !== null && incompleteCount !== null ? `${completeCount}/${completeCount + incompleteCount}` : null}
              description="Cashier selesai di cabang"
              href="/assessment"
              icon={ClipboardCheck}
              tone="success"
            />
            <DashboardMetric
              title="Skor di bawah 70"
              value={lowScoreCount}
              description="Perlu ditinjau atau didampingi"
              href="/leaderboard"
              icon={TrendingDown}
              tone="danger"
            />
            <DashboardMetric
              title="Pendampingan 30 hari"
              value={canMentoring ? mentoringResult.count ?? null : null}
              description="Sesi pada cabang Anda"
              href="/mentoring"
              icon={ClipboardCheck}
            />
            <DashboardMetric
              title="Notifikasi belum dibaca"
              value={canNotifications ? unreadResult.count ?? null : null}
              description="Tindakan dan alert"
              href="/notifications"
              icon={Bell}
            />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <ScoreList title="Performa teratas" rows={topScores} emptyLabel="Belum ada skor periode." />
            <ScoreList title="Prioritas terendah" rows={bottomScores} emptyLabel="Belum ada skor periode." />
          </div>
        </>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <DashboardMetric
            title="Perlu dinilai"
            value={incompleteCount}
            description="Cashier belum complete"
            href="/assessment"
            icon={ClipboardCheck}
            tone="warning"
          />
          <DashboardMetric
            title="Pendampingan 30 hari"
            value={canMentoring ? mentoringResult.count ?? null : null}
            description="Sesi terbaru di cabang"
            href="/mentoring"
            icon={ClipboardCheck}
          />
          <DashboardMetric
            title="Notifikasi belum dibaca"
            value={canNotifications ? unreadResult.count ?? null : null}
            description="Tindakan hari ini"
            href="/notifications"
            icon={Bell}
          />
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{currentPeriod ? `Periode ${formatDate(currentPeriod.start_date)}` : 'Aksi cepat'}</CardTitle>
          {currentPeriod && <Badge variant={closeReady ? 'success' : 'warning'}>{closeReady ? 'Siap' : 'Aktif'}</Badge>}
        </CardHeader>
        <div className="space-y-2 text-sm">
          {canLeaderboard && (
            <Link
              href="/leaderboard"
              className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
            >
              <div className="flex items-center gap-2.5">
                <Trophy className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <span>Lihat leaderboard periode</span>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
            </Link>
          )}
          {canMentoring && (
            <Link
              href="/mentoring"
              className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
            >
              <div className="flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 text-primary-600" aria-hidden="true" />
                <span>Buka pendampingan</span>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
            </Link>
          )}
          {(canCashiers || canAssessment) && (
            <Link
              href={dashboardHref}
              className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
            >
              <div className="flex items-center gap-2.5">
                <Users className="h-4 w-4 text-primary-600" aria-hidden="true" />
                <span>{canCashiers ? 'Kelola kasir' : 'Mulai penilaian'}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/settings/categories"
              className="flex items-center justify-between rounded-xl bg-surface-100 px-3 py-2.5 text-surface-700 transition-colors hover:bg-surface-200"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="h-4 w-4 text-purple-600" aria-hidden="true" />
                <span>Konfigurasi penilaian</span>
              </div>
              <ArrowRight className="h-4 w-4 text-surface-400" aria-hidden="true" />
            </Link>
          )}
        </div>
      </Card>
    </div>
  );
}
