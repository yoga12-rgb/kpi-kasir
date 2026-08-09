import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const transferSchema = z.object({
  outletId: z.string().uuid(),
  effectiveAt: z.string().datetime().optional(),
});
const cashierIdSchema = z.string().uuid();

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const parsedCashierId = cashierIdSchema.safeParse(id);
  if (!parsedCashierId.success) {
    return NextResponse.json({ error: 'ID kasir tidak valid' }, { status: 400 });
  }
  const body = await request.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('transfer_cashier_atomic', {
    p_cashier_id: parsedCashierId.data,
    p_target_outlet_id: parsed.data.outletId,
    p_effective_at: parsed.data.effectiveAt ?? new Date().toISOString(),
    p_actor_id: admin.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ cashier: data });
}

export const POST = withApiRoute(handlePOST);
