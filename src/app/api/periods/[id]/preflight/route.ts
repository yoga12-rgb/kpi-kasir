import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin']);
  const { id } = await params;
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('get_period_close_preflight', {
    p_period_id: id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ preflight: data });
}

export const GET = withApiRoute(handleGET);
