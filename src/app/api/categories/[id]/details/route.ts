import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const detailSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    type: z.enum(['scale', 'deduction']),
    scaleMax: z.number().finite().positive().optional().nullable(),
    deductionPoints: z.number().finite().positive().optional().nullable(),
  })
  .refine(
    (data) =>
      (data.type === 'scale' && data.scaleMax !== undefined && data.scaleMax !== null) ||
      (data.type === 'deduction' && data.deductionPoints !== undefined && data.deductionPoints !== null),
    {
      message: 'Detail skala wajib punya skala maks; detail deduksi wajib punya poin',
    }
  );

async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from('detail')
    .select('*')
    .eq('category_id', id)
    .order('name');

  return NextResponse.json({ details: data ?? [] });
}

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole(['admin']);
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = detailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc(
    'admin_create_detail',
    parsed.data.type === 'scale'
      ? {
          p_actor_id: profile.id,
          p_category_id: id,
          p_name: parsed.data.name,
          p_type: parsed.data.type,
          p_scale_max: parsed.data.scaleMax!,
        }
      : {
          p_actor_id: profile.id,
          p_category_id: id,
          p_name: parsed.data.name,
          p_type: parsed.data.type,
          p_deduction_points: parsed.data.deductionPoints!,
        }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ detail: data }, { status: 201 });
}

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST);
