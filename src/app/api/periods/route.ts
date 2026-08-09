import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('period')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(24);

  return NextResponse.json({ periods: data ?? [] });
}

export async function POST(request: Request) {
  const user = await requireRole(['admin']);
  const body = await request.json().catch(() => null);

  if (!body?.startDate || !body?.endDate) {
    return NextResponse.json({ error: 'Tanggal mulai & akhir wajib diisi' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('open_period', {
      p_start_date: body.startDate,
      p_end_date: body.endDate,
      p_performed_by: user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ period: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membuka periode' },
      { status: 400 }
    );
  }
}