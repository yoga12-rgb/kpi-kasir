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
import { getDashboardSnapshot } from '@/lib/dashboard/snapshot';
import { getUnreadNotificationCount } from '@/lib/notifications/unread';
import { logServerPerformance, nowMs } from '@/lib/performance/server';
import { createClient } from '@/lib/supabase/server';
import { withReturnTo } from '@/lib/navigation';
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
              href={withReturnTo(`/cashiers/${row.id}`, '/dashboard')}
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
  const dataStartedAt = nowMs();
  const [dashboardResult, unreadCount] = await Promise.all([
    getDashboardSnapshot(supabase, profile, permissions),
    canNotifications ? getUnreadNotificationCount(profile.id) : Promise.resolve(null),
  ]);
  logServerPerformance('dashboard-data', {
    durationMs: Number((nowMs() - dataStartedAt).toFixed(1)),
    source: dashboardResult.source,
    partialErrorCount: dashboardResult.errors.length,
  });
  const { snapshot, errors } = dashboardResult;
  const currentPeriod = snapshot.period;
  const cashierCount = snapshot.cashierCount;
  const completeCount = snapshot.completeCount;
  const incompleteCount = snapshot.incompleteCount;
  const lowScoreCount = snapshot.lowScoreCount;
  const mentoringCount = snapshot.mentoringCount;
  const invitePendingCount = snapshot.invitePendingCount;
  const inviteExpiredCount = snapshot.inviteExpiredCount;
  const configWeight = snapshot.configWeight;
  const configDetailCount = snapshot.configDetailCount;
  const configValid =
    isAdmin && currentPeriod && !errors.includes('konfigurasi periode')
      ? Math.abs(configWeight - 100) <= 0.001 && configDetailCount > 0
      : null;
  const closeReady =
    isAdmin && currentPeriod && completeCount !== null && incompleteCount !== null && configValid !== false
      ? configValid !== null
        ? configValid && incompleteCount === 0
        : incompleteCount === 0
      : null;

  const topScores: ScoreRow[] = snapshot.topScores;
  const bottomScores: ScoreRow[] = snapshot.bottomScores;
  const displayName = profile.full_name.split(' ')[0];
  const roleLabel = isAdmin ? 'Administrator' : profile.role === 'manager' ? 'Manager' : 'Supervisor';
  const dashboardHref = canCashiers ? '/cashiers' : canAssessment ? '/assessment' : '/dashboard';

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-surface-900">Halo, {displayName}</h1>
      <p className="mt-0.5 text-sm text-surface-500">
        {roleLabel}
        {currentPeriod ? ` - Periode ${formatDate(currentPeriod.startDate)}` : ''}
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
              value={cashierCount}
              description="Dalam cabang aktif"
              href="/cashiers"
              icon={Users}
            />
            <DashboardMetric
              title="Undangan aktif"
              value={invitePendingCount}
              description={inviteExpiredCount !== null ? `${inviteExpiredCount} sudah kedaluwarsa` : 'Status belum tersedia'}
              href="/settings/users?tab=invite"
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
              value={canNotifications ? unreadCount : null}
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
              value={canMentoring ? mentoringCount : null}
              description="Sesi pada cabang Anda"
              href="/mentoring"
              icon={ClipboardCheck}
            />
            <DashboardMetric
              title="Notifikasi belum dibaca"
              value={canNotifications ? unreadCount : null}
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
            value={canMentoring ? mentoringCount : null}
            description="Sesi terbaru di cabang"
            href="/mentoring"
            icon={ClipboardCheck}
          />
          <DashboardMetric
            title="Notifikasi belum dibaca"
            value={canNotifications ? unreadCount : null}
            description="Tindakan hari ini"
            href="/notifications"
            icon={Bell}
          />
        </div>
      )}

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>{currentPeriod ? `Periode ${formatDate(currentPeriod.startDate)}` : 'Aksi cepat'}</CardTitle>
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
