import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const paramsSchema = z.object({ id: z.string().uuid() });

const updateSchema = z
  .object({
    role: z.enum(['admin', 'manager', 'supervisor']).optional(),
    isActive: z.boolean().optional(),
    fullName: z.string().trim().min(2).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Tidak ada data yang diubah',
  });

async function handlePATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAdmin();
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = updateSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Data pengguna tidak valid' }, { status: 400 });
  }

  const targetId = parsedParams.data.id;
  if (
    targetId === actor.id &&
    (parsedBody.data.role !== undefined || parsedBody.data.isActive !== undefined)
  ) {
    return NextResponse.json(
      { error: 'Admin tidak dapat mengubah role atau status akunnya sendiri' },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('admin_update_user', {
    p_actor_id: actor.id,
    p_target_user_id: targetId,
    ...(parsedBody.data.role !== undefined ? { p_role: parsedBody.data.role } : {}),
    ...(parsedBody.data.isActive !== undefined ? { p_is_active: parsedBody.data.isActive } : {}),
    ...(parsedBody.data.fullName !== undefined ? { p_full_name: parsedBody.data.fullName } : {}),
  });

  if (error) {
    const status = error.message === 'Pengguna tidak ditemukan' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ user: data });
}

export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'user-write', limit: 30, windowMs: 10 * 60_000 },
});
