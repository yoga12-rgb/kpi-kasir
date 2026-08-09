import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const branchSchema = z.object({
  name: z.string().min(2),
  code: z.string().max(20).optional().nullable(),
});

export async function GET() {
  const profile = await requirePermission('branches.view');
  const supabase = await createClient();
  let query = supabase.from('branch').select('*, outlet(count)').order('name');
  if (profile.role !== 'admin') {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    query = query.in(
      'id',
      (userBranches ?? []).map((userBranch) => userBranch.branch_id)
    );
  }
  const { data } = await query;
  return NextResponse.json({ branches: data ?? [] });
}

export async function POST(request: Request) {
  await requireAdmin();
  const body = await request.json().catch(() => null);
  const parsed = branchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('branch')
    .insert({ name: parsed.data.name, code: parsed.data.code ?? null })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ branch: data }, { status: 201 });
}
