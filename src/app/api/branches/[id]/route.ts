import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().max(20).nullable().optional(),
  is_active: z.boolean().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin();
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  if (
    parsed.data.is_active !== undefined &&
    (parsed.data.name !== undefined || parsed.data.code !== undefined)
  ) {
    return NextResponse.json(
      { error: 'Perubahan status harus dikirim terpisah dari perubahan data cabang' },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  if (parsed.data.is_active !== undefined) {
    const { data, error } = await supabase.rpc('set_branch_status_guarded', {
      p_branch_id: id,
      p_is_active: parsed.data.is_active,
      p_reason: parsed.data.reason ?? 'Status cabang diubah melalui panel admin',
      p_actor_id: profile.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ branch: data });
  }

  const { data, error } = await supabase
    .from('branch')
    .update({ name: parsed.data.name, code: parsed.data.code })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ branch: data });
}

async function handleDELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin();
  const { id } = await params;
  const supabase = await createAdminClient();
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason : 'Dinonaktifkan melalui panel admin';

  const { data, error } = await supabase.rpc('set_branch_status_guarded', {
    p_branch_id: id,
    p_is_active: false,
    p_reason: reason,
    p_actor_id: profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ branch: data });
}

export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'branch-write', limit: 30, windowMs: 10 * 60_000 },
});
export const DELETE = withApiRoute(handleDELETE, {
  rateLimit: { name: 'branch-write', limit: 30, windowMs: 10 * 60_000 },
});
