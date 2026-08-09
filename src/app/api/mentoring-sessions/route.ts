import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const sessionSchema = z.object({
  outletId: z.string().uuid(),
  visitedDate: z.string(),
  noteOutlet: z.string().optional().nullable(),
  cashierNotes: z
    .array(
      z.object({
        cashierId: z.string().uuid(),
        note: z.string().min(1),
      })
    )
    .optional(),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid');
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
  branchId: z.string().uuid().optional(),
  outletId: z.string().uuid().optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

const cursorSchema = z.object({
  visitedDate: dateSchema,
  id: z.string().uuid(),
});

function encodeCursor(visitedDate: string, id: string) {
  return Buffer.from(JSON.stringify({ visitedDate, id })).toString('base64url');
}

function decodeCursor(value: string) {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function getAccessibleBranchIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  role: string,
  userId: string
) {
  if (role === 'admin') {
    const { data, error } = await supabase.from('branch').select('id').eq('is_active', true);
    return { ids: (data ?? []).map((branch) => branch.id), error };
  }

  const { data, error } = await supabase
    .from('user_branch')
    .select('branch_id')
    .eq('user_id', userId);
  return { ids: (data ?? []).map((branch) => branch.branch_id), error };
}

export async function GET(request: Request) {
  const user = await requirePermission('mentoring');
  const { searchParams } = new URL(request.url);
  const parsedQuery = listQuerySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Filter tidak valid' }, { status: 400 });
  }

  const { limit, cursor: cursorValue, branchId, outletId, from, to } = parsedQuery.data;
  if (from && to && from > to) {
    return NextResponse.json({ error: 'Rentang tanggal tidak valid' }, { status: 400 });
  }

  const cursor = cursorValue ? decodeCursor(cursorValue) : null;
  if (cursorValue && !cursor) {
    return NextResponse.json({ error: 'Cursor tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { ids: branchIds, error: branchError } = await getAccessibleBranchIds(
    supabase,
    user.role,
    user.id
  );

  if (branchError) {
    return NextResponse.json({ error: 'Gagal memeriksa akses cabang' }, { status: 500 });
  }

  if (branchIds.length === 0) {
    return NextResponse.json({ sessions: [], nextCursor: null, hasMore: false });
  }

  if (branchId && !branchIds.includes(branchId)) {
    return NextResponse.json({ error: 'Anda tidak memiliki akses ke cabang ini' }, { status: 403 });
  }

  if (outletId) {
    const { data: outlet } = await supabase
      .from('outlet')
      .select('id')
      .eq('id', outletId)
      .eq('is_active', true)
      .in('branch_id', branchIds)
      .maybeSingle();

    if (!outlet) {
      return NextResponse.json(
        { error: 'Anda tidak memiliki akses ke outlet ini' },
        { status: 403 }
      );
    }
  }

  let query = supabase
    .from('mentoring_session')
    .select(
      'id, outlet_id, visited_date, note_outlet, created_at, updated_at, outlet!inner(name, branch_id), conducted_by(full_name)'
    )
    .in('outlet.branch_id', branchIds)
    .order('visited_date', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (branchId) query = query.eq('outlet.branch_id', branchId);
  if (outletId) query = query.eq('outlet_id', outletId);
  if (from) query = query.gte('visited_date', from);
  if (to) query = query.lte('visited_date', to);
  if (cursor) {
    query = query.or(
      `visited_date.lt.${cursor.visitedDate},and(visited_date.eq.${cursor.visitedDate},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Gagal memuat sesi pendampingan' }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const sessions = rows.slice(0, limit);
  const lastSession = sessions[sessions.length - 1];

  return NextResponse.json({
    sessions,
    nextCursor:
      hasMore && lastSession ? encodeCursor(lastSession.visited_date, lastSession.id) : null,
    hasMore,
  });
}

export async function POST(request: Request) {
  const user = await requirePermission('mentoring');
  const body = await request.json().catch(() => null);
  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  // Validasi akses outlet via RLS (insert akan gagal jika tidak punya akses)
  const { data: session, error } = await supabase
    .from('mentoring_session')
    .insert({
      outlet_id: parsed.data.outletId,
      conducted_by: user.id,
      visited_date: parsed.data.visitedDate,
      note_outlet: parsed.data.noteOutlet ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Catat catatan per kasir
  if (parsed.data.cashierNotes && parsed.data.cashierNotes.length > 0) {
    const { error: notesError } = await supabase.from('mentoring_cashier_note').insert(
      parsed.data.cashierNotes.map((n) => ({
        session_id: session.id,
        cashier_id: n.cashierId,
        note: n.note,
      }))
    );

    if (notesError) return NextResponse.json({ error: notesError.message }, { status: 400 });
  }

  return NextResponse.json({ session }, { status: 201 });
}
