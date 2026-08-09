import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission('assessment');
  const { id } = await params;
  const supabase = await createClient();

  // Verifikasi parent assessment, periode, dan relasi kasir sebelum delete.
  const { data: deduction, error: lookupError } = await supabase
    .from('deduction_event')
    .select(
      'id, assessment_id, assessment!inner(period(status), cashier!inner(outlet!inner(branch_id)))'
    )
    .eq('id', id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 400 });
  if (!deduction) {
    return NextResponse.json({ error: 'Deduksi tidak ditemukan atau tidak dapat diakses' }, { status: 404 });
  }

  const assessment = deduction.assessment as unknown as {
    period: { status: 'open' | 'closed' };
  };
  if (assessment.period.status !== 'open') {
    return NextResponse.json({ error: 'Periode sudah ditutup' }, { status: 400 });
  }

  // RLS memverifikasi kembali parent dan cabang; trigger menghitung ulang skor.
  const { data: deleted, error } = await supabase
    .from('deduction_event')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!deleted) {
    return NextResponse.json({ error: 'Deduksi tidak ditemukan atau tidak dapat dihapus' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

export const DELETE = withApiRoute(handleDELETE);
