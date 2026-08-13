import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const statusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500),
  effectiveAt: z.string().datetime({ offset: true }).optional(),
});

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin();
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Status dan alasan tidak valid' }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('set_cashier_status_atomic', {
    p_cashier_id: id,
    p_is_active: parsed.data.isActive,
    p_reason: parsed.data.reason,
    p_actor_id: profile.id,
    ...(parsed.data.effectiveAt ? { p_effective_at: parsed.data.effectiveAt } : {}),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ cashier: data });
}

export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'cashier-status', limit: 30, windowMs: 10 * 60_000 },
});
