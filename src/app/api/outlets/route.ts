import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import { getTotalPages } from '@/lib/pagination';
import { queryOutlets } from '@/lib/server/list-queries';

const outletSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().min(2),
});

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  branchId: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
});

async function handleGET(request: Request) {
  const profile = await requirePermission('outlets.view');
  const searchParams = new URL(request.url).searchParams;
  const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success)
    return NextResponse.json({ error: 'Parameter outlet tidak valid' }, { status: 400 });
  const { limit, page, branchId, q } = parsed.data;

  const supabase = await createClient();
  const query = await queryOutlets(supabase, {
    actor: profile,
    branchId,
    page,
    pageSize: limit,
    search: q,
  });

  const { data, count } = await query;
  const totalPages = getTotalPages(count, limit);
  return NextResponse.json({
    outlets: data ?? [],
    page,
    limit,
    pageSize: limit,
    total: count ?? 0,
    totalPages,
    hasMore: page < totalPages,
  });
}

async function handlePOST(request: Request) {
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

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST);
