import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import { escapeIlike, getPageRange, getTotalPages } from '@/lib/pagination';

const cashierSchema = z.object({
  name: z.string().trim().min(2).max(100),
  outletId: z.string().uuid(),
  employmentStartDate: z.string().date(),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  outletId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

async function handleGET(request: Request) {
  await requirePermission('cashiers.view');
  const searchParams = new URL(request.url).searchParams;
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return NextResponse.json({ error: 'Parameter kasir tidak valid' }, { status: 400 });
  const { limit, page, outletId, branchId, q } = parsed.data;
  const { from, to } = getPageRange(page, limit);

  const supabase = await createClient();
  let query = supabase
    .from('cashier')
    .select('*, outlet!inner(name, branch:branch(name))', { count: 'exact' })
    .eq('is_active', true)
    .order('name')
    .range(from, to);

  if (outletId) query = query.eq('outlet_id', outletId);
  if (branchId) query = query.eq('outlet.branch_id', branchId);
  if (q) query = query.ilike('name', `%${escapeIlike(q)}%`);

  const { data, count } = await query;
  const totalPages = getTotalPages(count, limit);
  return NextResponse.json({
    cashiers: data ?? [],
    page,
    limit,
    total: count ?? 0,
    hasMore: page < totalPages,
  });
}

async function handlePOST(request: Request) {
  const profile = await requirePermission('cashiers.create');
  const body = await request.json().catch(() => null);
  const parsed = cashierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  if (parsed.data.employmentStartDate > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: 'Tanggal mulai kerja tidak boleh lebih dari hari ini' },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc('create_cashier_with_history', {
    p_name: parsed.data.name,
    p_outlet_id: parsed.data.outletId,
    p_employment_start_date: parsed.data.employmentStartDate,
    p_actor_id: profile.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ cashier: data }, { status: 201 });
}

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST);
