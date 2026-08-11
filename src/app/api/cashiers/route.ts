import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import { getTotalPages } from '@/lib/pagination';
import { queryCashiers } from '@/lib/server/list-queries';

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
  status: z.enum(['active', 'inactive', 'all']).default('active'),
});

async function handleGET(request: Request) {
  const profile = await requirePermission('cashiers.view');
  const searchParams = new URL(request.url).searchParams;
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success)
    return NextResponse.json({ error: 'Parameter kasir tidak valid' }, { status: 400 });
  const { limit, page, outletId, branchId, q } = parsed.data;
  const status = profile.role === 'admin' ? parsed.data.status : 'active';

  const supabase = await createClient();
  const query = await queryCashiers(supabase, {
    actor: profile,
    status,
    outletId,
    branchId,
    page,
    pageSize: limit,
    search: q,
  });

  const { data, count } = await query;
  const totalPages = getTotalPages(count, limit);
  const cashiers = (data ?? []).map((cashier) => ({
    ...cashier,
    avatar_src: cashier.avatar_url
      ? `/api/storage/cashier-avatar?path=${encodeURIComponent(cashier.avatar_url)}`
      : null,
  }));
  return NextResponse.json({
    cashiers,
    page,
    limit,
    pageSize: limit,
    total: count ?? 0,
    totalPages,
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
