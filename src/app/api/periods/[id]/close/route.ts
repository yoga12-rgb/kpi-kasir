import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const closeSchema = z.object({
  overrideIncomplete: z.boolean().default(false),
  overrideReason: z.string().trim().max(500).optional().nullable(),
});

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(['admin']);
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data penutupan tidak valid' }, { status: 400 });
  }

  try {
    const supabase = await createAdminClient();
    const { error } = await supabase.rpc('close_period', {
      p_period_id: id,
      p_performed_by: user.id,
      p_override_incomplete: parsed.data.overrideIncomplete,
      p_override_reason: parsed.data.overrideReason ?? null,
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

export const POST = withApiRoute(handlePOST);
