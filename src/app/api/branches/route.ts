import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import { escapeIlike, getPageRange, getTotalPages } from '@/lib/pagination';

const branchSchema = z.object({
  name: z.string().min(2),
  code: z.string().max(20).optional().nullable(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).optional(),
});

async function handleGET(request: Request) {
  const profile = await requirePermission('branches.view');
  const params = new URL(request.url).searchParams;
  const parsed = listQuerySchema.safeParse(Object.fromEntries(params.entries()));
  if (!parsed.success) return NextResponse.json({ error: 'Parameter cabang tidak valid' }, { status: 400 });
  const { limit, page, q } = parsed.data;
  const { from, to } = getPageRange(page, limit);
  const supabase = await createClient();
  let query = supabase
    .from('branch')
    .select('*, outlet(count)', { count: 'exact' })
    .order('name')
    .range(from, to);
  if (q) query = query.or(`name.ilike.%${escapeIlike(q)}%,code.ilike.%${escapeIlike(q)}%`);
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
  const { data, count } = await query;
  const totalPages = getTotalPages(count, limit);
  return NextResponse.json({
    branches: data ?? [],
    page,
    limit,
    total: count ?? 0,
    hasMore: page < totalPages,
  });
}

async function handlePOST(request: Request) {
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

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST);
