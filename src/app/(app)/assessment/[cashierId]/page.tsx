import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AssessmentForm, type CategoryWithDetails } from '@/components/assessment/AssessmentForm';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatScore } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function CashierAssessmentPage({
  params,
}: {
  params: Promise<{ cashierId: string }>;
}) {
  const profile = await requirePermission('assessment');
  const { cashierId } = await params;
  const supabase = await createClient();

  const cashierPromise = supabase
    .from('cashier')
    .select('id, name, outlet!inner(branch_id, name, branch(id, name, code))')
    .eq('id', cashierId)
    .single();
  const periodPromise = supabase
    .from('period')
    .select('id, label')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const branchAccessPromise =
    profile.role === 'admin'
      ? Promise.resolve({ data: [] as { branch_id: string }[] })
      : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id);
  const [cashierResult, periodResult, branchAccessResult] = await Promise.all([
    cashierPromise,
    periodPromise,
    branchAccessPromise,
  ]);
  const cashier = cashierResult.data;

  if (!cashier) notFound();

  const outlet = cashier.outlet as unknown as {
    branch_id: string;
    name: string;
    branch?: { id: string; name: string; code: string | null };
  };
  const branch = outlet.branch;

  // Cek akses non-admin
  if (profile.role !== 'admin') {
    const allowed = (branchAccessResult.data ?? []).map((assignment) => assignment.branch_id);
    if (!allowed.includes(outlet.branch_id)) redirect('/dashboard');
  }

  const period = periodResult.data;

  if (!period) {
    return (
      <div className="p-4">
        <p className="text-sm text-surface-500">Tidak ada periode aktif.</p>
      </div>
    );
  }

  // Semua query ini hanya bergantung pada periode dan kasir yang sudah tervalidasi.
  const [categorySnapshotsResult, detailSnapshotsResult, assessmentsResult, periodScoreResult, completionResult] =
    await Promise.all([
      supabase
        .from('category_weight_history')
        .select('category_id, category_name, weight')
        .eq('period_id', period.id)
        .order('category_name'),
      supabase
        .from('detail_config_history')
        .select('detail_id, category_id, detail_name, detail_type, scale_max, deduction_points')
        .eq('period_id', period.id)
        .order('detail_name'),
      supabase
        .from('assessment')
        .select('id, detail_id, scale_value, normalized_score')
        .eq('period_id', period.id)
        .eq('cashier_id', cashierId),
      supabase
        .from('cashier_period_score')
        .select('total_score, category_scores')
        .eq('period_id', period.id)
        .eq('cashier_id', cashierId)
        .maybeSingle(),
      supabase
        .from('cashier_period_completion')
        .select('status, assessed_details, total_details')
        .eq('period_id', period.id)
        .eq('cashier_id', cashierId)
        .maybeSingle(),
    ]);
  const categorySnapshots = categorySnapshotsResult.data;
  const detailSnapshots = detailSnapshotsResult.data;
  const assessments = assessmentsResult.data;
  const periodScore = periodScoreResult.data;
  const completion = completionResult.data;

  const assessmentMap = new Map((assessments ?? []).map((a) => [a.detail_id, a]));

  // Deduction events per assessment
  const assessmentIds = (assessments ?? []).map((a) => a.id);
  const { data: deductionEvents } =
    assessmentIds.length > 0
      ? await supabase
          .from('deduction_event')
          .select('id, assessment_id, note, points, occurred_at')
          .in('assessment_id', assessmentIds)
          .order('occurred_at', { ascending: true })
      : { data: [] };

  const eventMap = new Map<string, typeof deductionEvents>();
  for (const e of deductionEvents ?? []) {
    const list = eventMap.get(e.assessment_id) ?? [];
    list.push(e);
    eventMap.set(e.assessment_id, list);
  }

  const detailsByCategory = new Map<string, NonNullable<typeof detailSnapshots>>();
  for (const detail of detailSnapshots ?? []) {
    if (!detail.category_id) continue;
    const list = detailsByCategory.get(detail.category_id) ?? [];
    list.push(detail);
    detailsByCategory.set(detail.category_id, list);
  }

  const formCategories: CategoryWithDetails[] = (categorySnapshots ?? []).map((cat) => ({
    id: cat.category_id,
    name: cat.category_name ?? 'Kategori',
    weight: Number(cat.weight),
    details: (detailsByCategory.get(cat.category_id) ?? []).flatMap((d) => {
      if (d.detail_type !== 'scale' && d.detail_type !== 'deduction') return [];

      const a = assessmentMap.get(d.detail_id);
      return [
        {
          id: d.detail_id,
          name: d.detail_name ?? 'Detail',
          type: d.detail_type,
          scale_max: d.scale_max !== null ? Number(d.scale_max) : null,
          deduction_points: d.deduction_points !== null ? Number(d.deduction_points) : null,
          scale_value: d.detail_type === 'scale' ? Number(a?.scale_value ?? null) : null,
          normalized_score: Number(a?.normalized_score ?? (d.detail_type === 'scale' ? 0 : 100)),
          assessment_id: a?.id ?? null,
          deduction_events:
            d.detail_type === 'deduction' && a
              ? (eventMap.get(a.id) ?? []).map((e) => ({
                  id: e.id,
                  note: e.note,
                  points: Number(e.points),
                  occurred_at: e.occurred_at,
                }))
              : [],
        },
      ];
    }),
  }));

  const completionLabel =
    completion?.status === 'complete'
      ? 'Selesai'
      : completion?.status === 'in_progress'
        ? `Berjalan ${completion.assessed_details}/${completion.total_details}`
        : 'Belum mulai';

  return (
    <div className="p-4">
        <Link
          href="/assessment"
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Penilaian</span>
        </Link>

        <div className="mt-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-surface-900">{cashier.name}</h1>
            {branch?.code && (
              <span className="rounded-md bg-surface-200/80 px-2 py-0.5 text-xs font-semibold text-surface-700">
                {branch.code}
              </span>
            )}
          </div>
          <p className="text-sm text-surface-500">
            {branch?.name ? `${branch.name} · ` : ''}
            {outlet.name} · Periode {period.label}
          </p>
        </div>

        <div className="mt-3 rounded-xl bg-primary-50 p-3 text-sm text-primary-800">
          Skor saat ini:{' '}
          <span className="font-bold">{formatScore(Number(periodScore?.total_score ?? 0))}</span>
          <span className="ml-2 text-xs text-primary-700">· {completionLabel}</span>
        </div>

        <div className="mt-4">
          <AssessmentForm cashierId={cashier.id} periodId={period.id} categories={formCategories} />
        </div>
    </div>
  );
}
