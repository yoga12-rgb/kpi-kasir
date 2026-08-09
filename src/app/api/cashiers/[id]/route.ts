import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();

  // Soft delete: nonaktifkan kasir
  const { data, error } = await supabase
    .from('cashier')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) {
    return NextResponse.json({ error: 'Kasir tidak ditemukan' }, { status: 404 });
  }
  return NextResponse.json({ cashier: data });
}
