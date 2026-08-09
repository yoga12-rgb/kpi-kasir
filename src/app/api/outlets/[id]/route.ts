import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const updateSchema = z.object({
  branchId: z.string().uuid().optional(),
  name: z.string().min(2).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('outlets.update');
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
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

  const update: Record<string, unknown> = {};
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('outlet')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ outlet: data });
}
