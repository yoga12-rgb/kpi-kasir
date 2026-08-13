import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const statusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; detailId: string }> }
) {
  const profile = await requireRole(['admin']);
  const { id, detailId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'Status dan alasan perubahan tidak valid' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data: detail, error: detailError } = await supabase
    .from('detail')
    .select('id, category_id')
    .eq('id', detailId)
    .maybeSingle();

  if (detailError) return NextResponse.json({ error: detailError.message }, { status: 400 });
  if (!detail || detail.category_id !== id) {
    return NextResponse.json(
      { error: 'Detail tidak ditemukan pada kategori ini' },
      { status: 404 }
    );
  }

  const { data, error } = await supabase.rpc('admin_set_detail_status', {
    p_actor_id: profile.id,
    p_detail_id: detailId,
    p_is_active: parsed.data.isActive,
    p_reason: parsed.data.reason,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ detail: data });
}

export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'detail-write', limit: 60, windowMs: 10 * 60_000 },
});
