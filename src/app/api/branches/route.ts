import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import { getTotalPages } from '@/lib/pagination';
import { queryBranches } from '@/lib/server/list-queries';

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
  if (!parsed.success)
    return NextResponse.json({ error: 'Parameter cabang tidak valid' }, { status: 400 });
  const { limit, page, q } = parsed.data;
  const supabase = await createClient();
  const query = await queryBranches(supabase, {
    actor: profile,
    page,
    pageSize: limit,
    search: q,
  });
  const { data, count } = await query;
  const totalPages = getTotalPages(count, limit);
  return NextResponse.json({
    branches: data ?? [],
    page,
    limit,
    pageSize: limit,
    total: count ?? 0,
    totalPages,
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
  const branch = {
    id: randomUUID(),
    name: parsed.data.name,
    code: parsed.data.code ?? null,
  };
  const { error } = await supabase.from('branch').insert(branch);

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Kode cabang sudah digunakan' }, { status: 409 });
    }
    console.error('[branches] insert failed', {
      code: error.code,
    });
    return NextResponse.json({ error: 'Cabang tidak dapat disimpan' }, { status: 500 });
  }

  return NextResponse.json({ branch }, { status: 201 });
}

export const GET = withApiRoute(handleGET);
export const POST = withApiRoute(handlePOST, {
  rateLimit: { name: 'branch-create', limit: 30, windowMs: 10 * 60_000 },
});
