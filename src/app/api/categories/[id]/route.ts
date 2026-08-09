import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  weight: z.number().finite().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
});

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(['admin']);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('admin_update_category', {
    p_actor_id: profile.id,
    p_category_id: id,
    ...(parsed.data.name !== undefined ? { p_name: parsed.data.name } : {}),
    ...(parsed.data.weight !== undefined ? { p_weight: parsed.data.weight } : {}),
    ...(parsed.data.is_active !== undefined ? { p_is_active: parsed.data.is_active } : {}),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data });
}

async function handleDELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(['admin']);
  const { id } = await params;
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('admin_update_category', {
    p_actor_id: profile.id,
    p_category_id: id,
    p_is_active: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data });
}

export const PATCH = withApiRoute(handlePATCH);
export const DELETE = withApiRoute(handleDELETE);
