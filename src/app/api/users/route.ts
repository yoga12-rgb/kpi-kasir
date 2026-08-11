import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';
import { getTotalPages } from '@/lib/pagination';
import { queryUsers } from '@/lib/server/list-queries';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  q: z.string().trim().max(100).optional(),
});

async function handleGET(request: Request) {
  await requireRole(['admin']);
  const parsed = listQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parameter pengguna tidak valid' }, { status: 400 });
  }

  const { limit, page, q } = parsed.data;
  const supabase = await createClient();
  const query = await queryUsers(supabase, { page, pageSize: limit, search: q });

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Daftar pengguna tidak dapat dimuat' }, { status: 500 });
  }

  const total = count ?? 0;
  const totalPages = getTotalPages(total, limit);
  return NextResponse.json({
    users: (data ?? []).map((user) => ({ ...user, created_label: formatDate(user.created_at) })),
    page,
    limit,
    pageSize: limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  });
}

export const GET = withApiRoute(handleGET);
