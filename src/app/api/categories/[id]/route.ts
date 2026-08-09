import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { validateCategoryWeightChange } from '@/lib/categories';

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  weight: z.number().min(0).max(100).optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin']);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  // Validasi total bobot jika mengubah bobot
  if (parsed.data.weight !== undefined) {
    const { valid, total } = await validateCategoryWeightChange(
      supabase,
      id,
      parsed.data.weight
    );
    if (!valid) {
      return NextResponse.json(
        { error: `Total bobot harus 100% (akan menjadi ${Math.round(total * 100) / 100}%)` },
        { status: 400 }
      );
    }
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name) update.name = parsed.data.name;
  if (parsed.data.weight !== undefined) update.weight = parsed.data.weight;
  if (parsed.data.is_active !== undefined) update.is_active = parsed.data.is_active;

  const { data, error } = await supabase
    .from('category')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin']);
  const { id } = await params;
  const supabase = await createClient();

  // Soft delete: nonaktifkan kategori
  const { data, error } = await supabase
    .from('category')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data });
}