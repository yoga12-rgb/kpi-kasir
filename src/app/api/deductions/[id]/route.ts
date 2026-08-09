import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission('assessment');
  const { id } = await params;
  const supabase = await createClient();

  // RLS menjamin akses; trigger akan hitung ulang skor
  const { error } = await supabase.from('deduction_event').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}
