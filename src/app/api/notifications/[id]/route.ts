import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';
import { createClient } from '@/lib/supabase/server';

async function handlePATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('notifications');
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'ID notifikasi tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('notification')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', profile.id);

  if (error) return NextResponse.json({ error: 'Gagal menandai notifikasi' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export const PATCH = withApiRoute(handlePATCH);
