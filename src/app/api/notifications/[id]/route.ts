import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('notifications');
  const { id } = await params;
  const supabase = await createClient();

  const { error } = await supabase
    .from('notification')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', profile.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
