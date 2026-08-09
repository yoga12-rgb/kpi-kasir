import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const rosterSchema = z.object({
  cashierId: z.string().uuid(),
  effectiveAt: z.string().datetime().optional(),
  reason: z.string().trim().min(3).max(200).default('cashier_joined_mid_period'),
});

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole(['admin']);
  const { id: periodId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = rosterSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Data roster tidak valid' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('add_cashier_to_period_roster', {
    p_period_id: periodId,
    p_cashier_id: parsed.data.cashierId,
    p_effective_at: parsed.data.effectiveAt ?? new Date().toISOString(),
    p_reason: parsed.data.reason,
    p_performed_by: user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ roster: data }, { status: 201 });
}

export const POST = withApiRoute(handlePOST);
