import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import type { TablesUpdate } from '@/types/database';

const updateSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  is_active: z.boolean().optional(),
  reason: z.string().trim().min(3).max(500).optional(),
});

async function handlePATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('outlets.update');
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  if (parsed.data.is_active !== undefined) {
    if (profile.role !== 'admin') {
      return NextResponse.json({ error: 'Hanya admin yang dapat mengubah status outlet' }, { status: 403 });
    }
    if (parsed.data.name !== undefined || parsed.data.branchId !== undefined) {
      return NextResponse.json(
        { error: 'Perubahan status harus dikirim terpisah dari perubahan data outlet' },
        { status: 400 }
      );
    }
    const adminSupabase = await createAdminClient();
    const { data, error } = await adminSupabase.rpc('set_outlet_status_guarded', {
      p_outlet_id: id,
      p_is_active: parsed.data.is_active,
      p_reason: parsed.data.reason ?? 'Status outlet diubah melalui panel admin',
      p_actor_id: profile.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ outlet: data });
  }

  const supabase = profile.role === 'admin' ? await createAdminClient() : await createClient();
  const { data: currentOutlet, error: currentOutletError } = await supabase
    .from('outlet')
    .select('id, branch_id')
    .eq('id', id)
    .single();

  if (currentOutletError || !currentOutlet) {
    return NextResponse.json({ error: 'Outlet tidak ditemukan' }, { status: 404 });
  }

  if (profile.role !== 'admin') {
    if (parsed.data.name === undefined) {
      return NextResponse.json({ error: 'Nama outlet wajib diisi' }, { status: 400 });
    }

    const { data: userBranch } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id)
      .eq('branch_id', currentOutlet.branch_id)
      .maybeSingle();

    if (!userBranch) {
      return NextResponse.json(
        { error: 'Outlet berada di luar cabang yang ditugaskan' },
        { status: 403 }
      );
    }
  }

  const update: TablesUpdate<'outlet'> = {};
  if (profile.role === 'admin') {
    if (parsed.data.branchId) update.branch_id = parsed.data.branchId;
    if (parsed.data.name) update.name = parsed.data.name;
    if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;
  } else {
    update.name = parsed.data.name;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Tidak ada data yang diubah' }, { status: 400 });
  }

  const { error } = await supabase.from('outlet').update(update).eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ outlet: { id, ...update } });
}

async function handleDELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdmin();
  const { id } = await params;
  const supabase = await createAdminClient();
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === 'string' ? body.reason : 'Dinonaktifkan melalui panel admin';

  const { data, error } = await supabase.rpc('set_outlet_status_guarded', {
    p_outlet_id: id,
    p_is_active: false,
    p_reason: reason,
    p_actor_id: profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ outlet: data });
}

export const PATCH = withApiRoute(handlePATCH, {
  rateLimit: { name: 'outlet-write', limit: 30, windowMs: 10 * 60_000 },
});
export const DELETE = withApiRoute(handleDELETE, {
  rateLimit: { name: 'outlet-write', limit: 30, windowMs: 10 * 60_000 },
});
