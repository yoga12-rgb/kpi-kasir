import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PeriodForm } from '@/components/periods/PeriodForm';
import { ClosePeriodButton } from '@/components/periods/ClosePeriodButton';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export default async function PeriodsPage() {
  await requireRole(['admin']);
  const supabase = await createClient();

  const { data: periods } = await supabase
    .from('period')
    .select('id, label, start_date, end_date, status')
    .order('start_date', { ascending: false })
    .limit(24);

  return (
    <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Periode Penilaian</h1>
        <p className="mt-0.5 text-sm text-surface-500">Kelola periode penilaian</p>

        <div className="mt-4 space-y-3">
          {(periods ?? []).map((period) => (
            <Card key={period.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-surface-900">{period.label}</p>
                <p className="text-sm text-surface-500">
                  {formatDate(period.start_date)} — {formatDate(period.end_date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {period.status === 'open' ? (
                  <>
                    <Badge variant="success">Aktif</Badge>
                    <ClosePeriodButton periodId={period.id} />
                  </>
                ) : (
                  <Badge variant="muted">Ditutup</Badge>
                )}
              </div>
            </Card>
          ))}
          {(periods ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-surface-500">Belum ada periode.</p>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Buka Periode Baru</h2>
          <PeriodForm />
        </div>
    </div>
  );
}
