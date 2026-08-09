import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  weight: z.number().finite().min(0).max(100),
});

async function handleGET() {
  const supabase = await createClient();
  const { data } = await supabase.from('category').select('*, detail(count)').order('name');
  return NextResponse.json({ categories: data ?? [] });
}

async function handlePOST(request: Request) {
  const profile = await requireRole(['admin']);

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('admin_create_category', {
    p_actor_id: profile.id,
    p_name: parsed.data.name,
    p_weight: parsed.data.weight,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ category: data }, { status: 201 });
}

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST);
