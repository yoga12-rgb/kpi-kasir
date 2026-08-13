import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission('cashiers.update');
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('cashier')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) {
    return NextResponse.json(
      { error: 'Kasir tidak ditemukan atau Anda tidak memiliki akses untuk mengubahnya' },
      { status: 404 }
    );
  }
  return NextResponse.json({ cashier: data });
}

async function handleDELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin();
  const { id } = await params;
  const supabase = await createAdminClient();
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason : 'Dinonaktifkan melalui panel admin';

  const { data, error } = await supabase.rpc('set_cashier_status_atomic', {
    p_cashier_id: id,
    p_is_active: false,
    p_reason: reason,
    p_actor_id: profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ cashier: data });
}

export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'cashier-write', limit: 60, windowMs: 10 * 60_000 },
});
export const DELETE = withApiRoute(handleDELETE, {
  rateLimit: { name: 'cashier-write', limit: 30, windowMs: 10 * 60_000 },
});
