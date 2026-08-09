import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';
import { createClient } from '@/lib/supabase/server';

async function handlePOST() {
  const profile = await requirePermission('notifications');
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notification')
    .update({ is_read: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)
    .select('id');

  if (error) return NextResponse.json({ error: 'Gagal menandai notifikasi' }, { status: 500 });
  return NextResponse.json({ success: true, updatedCount: data?.length ?? 0 });
}

export const POST = withApiRoute(handlePOST);
