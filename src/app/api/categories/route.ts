import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { validateCategoryWeights } from '@/lib/categories';

const categorySchema = z.object({
  name: z.string().min(2),
  weight: z.number().min(0).max(100),
});

export async function GET() {
  const supabase = await createClient();
  const { data } = await supabase.from('category').select('*, detail(count)').order('name');
  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: Request) {
  await requireRole(['admin']);

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  // Validasi total bobot
  const { valid, total } = await validateCategoryWeights(supabase);
  if (!valid) {
    return NextResponse.json(
      { error: `Total bobot harus 100% (saat ini ${total}%)` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('category')
    .insert({ name: parsed.data.name, weight: parsed.data.weight })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data }, { status: 201 });
}