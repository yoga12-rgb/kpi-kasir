import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['admin']);
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('close_period', {
      p_period_id: id,
      p_performed_by: user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menutup periode' },
      { status: 400 }
    );
  }
}