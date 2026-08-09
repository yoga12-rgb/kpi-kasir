import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const outletSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(2),
});

export async function GET(request: Request) {
  const profile = await requirePermission('outlets.view');
  const { searchParams } = new URL(request.url);
  const branchId = searchParams.get('branchId');

  const supabase = await createClient();
  let query = supabase.from('outlet').select('*, branch(name)').order('name');
  if (branchId) query = query.eq('branch_id', branchId);
  if (profile.role !== 'admin') {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    query = query.in(
      'branch_id',
      (userBranches ?? []).map((userBranch) => userBranch.branch_id)
    );
  }

  const { data } = await query;
  return NextResponse.json({ outlets: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await requirePermission('outlets.create');
  const body = await request.json().catch(() => null);
  const parsed = outletSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  if (profile.role !== 'admin') {
    const { data: userBranch } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id)
      .eq('branch_id', parsed.data.branchId)
      .maybeSingle();
    if (!userBranch) {
      return NextResponse.json(
        { error: 'Cabang tidak termasuk dalam penugasan Anda' },
        { status: 403 }
      );
    }
  }

  const { error } = await supabase
    .from('outlet')
    .insert({ branch_id: parsed.data.branchId, name: parsed.data.name });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    { outlet: { branch_id: parsed.data.branchId, name: parsed.data.name } },
    { status: 201 }
  );
}
