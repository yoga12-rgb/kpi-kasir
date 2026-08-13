import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const deductionSchema = z.object({
  note: z.string().optional().nullable(),
  occurredAt: z.string().optional(),
});

/**
 * Catat kejadian deduksi.
 * - Pastikan assessment rujukan bertipe deduction.
 * - Poin per kejadian diambil dari konfigurasi detail yang berlaku untuk periode
 *   (detail_config_history → detail.deduction_points) — non-retroaktif.
 * - Trigger akan menghitung ulang skor normalisasi & skor periode.
 */
async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('assessment');
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = deductionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  // Ambil assessment + detail + periode
  const { data: assessment } = await supabase
    .from('assessment')
    .select('*, detail(*), period(status), cashier!inner(id, outlet!inner(branch_id))')
    .eq('id', id)
    .single();

  if (!assessment) {
    return NextResponse.json({ error: 'Assessment tidak ditemukan' }, { status: 404 });
  }

  const period = assessment.period as unknown as { status: 'open' | 'closed' };

  if (period.status !== 'open') {
    return NextResponse.json({ error: 'Periode sudah ditutup' }, { status: 400 });
  }

  // Konfigurasi poin per periode berasal dari snapshot.
  const { data: historyConfig } = await supabase
    .from('detail_config_history')
    .select('deduction_points, detail_type')
    .eq('detail_id', assessment.detail_id)
    .eq('period_id', assessment.period_id)
    .maybeSingle();

  if (!historyConfig || historyConfig.detail_type !== 'deduction') {
    return NextResponse.json(
      { error: 'Detail tidak termasuk konfigurasi snapshot periode ini' },
      { status: 400 }
    );
  }

  const points = historyConfig.deduction_points;

  if (!points || points <= 0) {
    return NextResponse.json({ error: 'Konfigurasi poin deduksi tidak valid' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('deduction_event')
    .insert({
      assessment_id: id,
      note: parsed.data.note ?? null,
      points: Number(points),
      occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ deduction: data }, { status: 201 });
}

export const POST = withApiRoute(handlePOST, {
  rateLimit: { name: 'deduction-write', limit: 60, windowMs: 10 * 60_000 },
});
