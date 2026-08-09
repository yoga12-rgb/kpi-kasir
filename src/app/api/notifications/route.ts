import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';
import { decodeNotificationCursor, encodeNotificationCursor } from '@/lib/notifications/cursor';
import { createClient } from '@/lib/supabase/server';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().trim().min(1).max(512).optional(),
});

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function handleGET(request: Request) {
  const profile = await requirePermission('notifications');
  const params = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    limit: params.get('limit') ?? undefined,
    cursor: params.get('cursor') ?? undefined,
  });

  if (!parsed.success) return error('Parameter notifikasi tidak valid');

  const cursor = parsed.data.cursor
    ? decodeNotificationCursor(parsed.data.cursor)
    : null;
  if (parsed.data.cursor && !cursor) return error('Cursor notifikasi tidak valid');

  const supabase = await createClient();
  let feedQuery = supabase
    .from('notification')
    .select(
      'id, type, title, body, payload, entity_type, entity_id, period_id, is_read, created_at'
    )
    .eq('user_id', profile.id);

  if (cursor) {
    feedQuery = feedQuery.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const [feedResult, unreadResult] = await Promise.all([
    feedQuery.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(parsed.data.limit + 1),
    supabase
      .from('notification')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('is_read', false),
  ]);

  if (feedResult.error || unreadResult.error) {
    return error('Gagal memuat notifikasi', 500);
  }

  const rows = feedResult.data ?? [];
  const hasMore = rows.length > parsed.data.limit;
  const notifications = hasMore ? rows.slice(0, parsed.data.limit) : rows;
  const last = notifications[notifications.length - 1];
  const nextCursor = hasMore && last
    ? encodeNotificationCursor({ createdAt: last.created_at, id: last.id })
    : null;

  return NextResponse.json({
    notifications,
    nextCursor,
    hasMore,
    unreadCount: unreadResult.count ?? 0,
  });
}

export const GET = withApiRoute(handleGET);
