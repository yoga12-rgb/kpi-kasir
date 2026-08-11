import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { revalidatePeriodOptions } from '@/lib/cache/reference';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

async function handleGET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('period')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(24);

  return NextResponse.json({ periods: data ?? [] });
}

async function handlePOST(request: Request) {
  const user = await requireRole(['admin']);
  const body = await request.json().catch(() => null);

  if (!body?.startDate || !body?.endDate) {
    return NextResponse.json({ error: 'Tanggal mulai & akhir wajib diisi' }, { status: 400 });
  }

  try {
    const supabase = await createAdminClient();
    const { data, error } = await supabase.rpc('open_period', {
      p_start_date: body.startDate,
      p_end_date: body.endDate,
      p_performed_by: user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    revalidatePeriodOptions();
    return NextResponse.json({ period: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal membuka periode' },
      { status: 400 }
    );
  }
}

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST);
