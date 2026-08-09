import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const assessmentSchema = z.object({
  periodId: z.string().uuid(),
  cashierId: z.string().uuid(),
  detailId: z.string().uuid(),
  scaleValue: z.number().min(0).optional().nullable(),
});

/**
 * Input/update penilaian skala.
 * - Cek periode masih open.
 * - Cek detail tipe scale.
 * - Ambil scale_max dari detail_config_history (non-retroaktif) atau detail.
 * - Hitung normalized_score via RPC compute_normalized_score.
 */
export async function POST(request: Request) {
  const user = await requirePermission('assessment');
  const body = await request.json().catch(() => null);
  const parsed = assessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  // Cek periode open
  const { data: period } = await supabase
    .from('period')
    .select('status')
    .eq('id', parsed.data.periodId)
    .single();

  if (!period || period.status !== 'open') {
    return NextResponse.json(
      { error: 'Periode tidak ditemukan atau sudah ditutup' },
      { status: 400 }
    );
  }

  // Cek cashier akses (RLS juga menjamin)
  const { data: cashier } = await supabase
    .from('cashier')
    .select('*, outlet!inner(branch_id)')
    .eq('id', parsed.data.cashierId)
    .single();

  if (!cashier) {
    return NextResponse.json({ error: 'Kasir tidak ditemukan' }, { status: 404 });
  }

  // Cek detail + konfigurasi
  const { data: detail } = await supabase
    .from('detail')
    .select('*')
    .eq('id', parsed.data.detailId)
    .single();

  if (!detail) {
    return NextResponse.json({ error: 'Detail tidak ditemukan' }, { status: 404 });
  }

  // Detail tipe deduction: buat assessment awal dengan skor 100 (tanpa scale_value).
  // Kejadian deduksi dicatat lewat endpoint /api/assessments/[id]/deductions.
  if (detail.type === 'deduction') {
    const { data, error } = await supabase
      .from('assessment')
      .upsert(
        {
          period_id: parsed.data.periodId,
          cashier_id: parsed.data.cashierId,
          detail_id: parsed.data.detailId,
          scale_value: null,
          normalized_score: 100,
          assessed_by: user.id,
          assessed_at: new Date().toISOString(),
        },
        { onConflict: 'period_id,cashier_id,detail_id' }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ assessment: data });
  }

  // Konfigurasi detail untuk periode (non-retroaktif)
  const { data: historyConfig } = await supabase
    .from('detail_config_history')
    .select('scale_max')
    .eq('detail_id', parsed.data.detailId)
    .eq('period_id', parsed.data.periodId)
    .maybeSingle();

  const scaleMax = historyConfig?.scale_max ?? detail.scale_max;

  if (!scaleMax || scaleMax <= 0) {
    return NextResponse.json({ error: 'Konfigurasi skala tidak valid' }, { status: 400 });
  }

  // Validasi rentang
  if (parsed.data.scaleValue === null || parsed.data.scaleValue === undefined) {
    return NextResponse.json({ error: 'Nilai skala wajib diisi' }, { status: 400 });
  }
  if (parsed.data.scaleValue < 0 || parsed.data.scaleValue > Number(scaleMax)) {
    return NextResponse.json({ error: `Nilai harus antara 0 dan ${scaleMax}` }, { status: 400 });
  }

  // Hitung normalisasi via RPC
  const { data: normalized } = await supabase.rpc('compute_normalized_score', {
    p_scale_value: parsed.data.scaleValue,
    p_scale_max: Number(scaleMax),
  });

  // Upsert assessment (trigger akan hitung ulang skor)
  const { data, error } = await supabase
    .from('assessment')
    .upsert(
      {
        period_id: parsed.data.periodId,
        cashier_id: parsed.data.cashierId,
        detail_id: parsed.data.detailId,
        scale_value: parsed.data.scaleValue,
        normalized_score: Number(normalized ?? 0),
        assessed_by: user.id,
        assessed_at: new Date().toISOString(),
      },
      { onConflict: 'period_id,cashier_id,detail_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ assessment: data });
}

export async function PATCH(request: Request) {
  return POST(request);
}
