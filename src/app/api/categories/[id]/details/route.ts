import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const detailSchema = z
  .object({
    name: z.string().min(2),
    type: z.enum(['scale', 'deduction']),
    scaleMax: z.number().min(1).optional().nullable(),
    deductionPoints: z.number().min(1).optional().nullable(),
  })
  .refine(
    (data) =>
      (data.type === 'scale' && data.scaleMax !== undefined && data.scaleMax !== null) ||
      (data.type === 'deduction' && data.deductionPoints !== undefined && data.deductionPoints !== null),
    {
      message: 'Detail skala wajib punya skala maks; detail deduksi wajib punya poin',
    }
  );

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('detail')
    .select('*')
    .eq('category_id', id)
    .order('name');

  return NextResponse.json({ details: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole(['admin']);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = detailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('detail')
    .insert({
      category_id: id,
      name: parsed.data.name,
      type: parsed.data.type,
      scale_max: parsed.data.type === 'scale' ? parsed.data.scaleMax : null,
      deduction_points: parsed.data.type === 'deduction' ? parsed.data.deductionPoints : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ detail: data }, { status: 201 });
}