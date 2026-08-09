import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const transferSchema = z.object({
  outletId: z.string().uuid(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  // Ambil kasir
  const { data: cashier, error: cashierError } = await supabase
    .from('cashier')
    .select('*, outlet!inner(branch_id)')
    .eq('id', id)
    .single();

  if (cashierError || !cashier) {
    return NextResponse.json({ error: 'Kasir tidak ditemukan' }, { status: 404 });
  }

  // Tutup riwayat penempatan aktif
  await supabase
    .from('cashier_outlet_history')
    .update({ ended_at: new Date().toISOString() })
    .eq('cashier_id', id)
    .is('ended_at', null);

  // Pindah outlet + buat riwayat baru
  const { error: updateError } = await supabase
    .from('cashier')
    .update({ outlet_id: parsed.data.outletId })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  await supabase
    .from('cashier_outlet_history')
    .insert({ cashier_id: id, outlet_id: parsed.data.outletId });

  return NextResponse.json({ success: true });
}
