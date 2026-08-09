import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const profile = await requirePermission('notifications');
  const supabase = await createClient();

  const { data } = await supabase
    .from('notification')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const { count: unreadCount } = await supabase
    .from('notification')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_read', false);

  return NextResponse.json({ notifications: data ?? [], unreadCount: unreadCount ?? 0 });
}
