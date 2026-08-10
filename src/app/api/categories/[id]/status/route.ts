import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const statusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(['admin']);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Status dan alasan perubahan tidak valid' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('admin_set_category_status', {
    p_actor_id: profile.id,
    p_category_id: id,
    p_is_active: parsed.data.isActive,
    p_reason: parsed.data.reason,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data });
}

export const PATCH = withApiRoute(handlePATCH);
