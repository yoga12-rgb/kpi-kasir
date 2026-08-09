import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

async function handleGET() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('period')
    .select('*')
    .eq('status', 'open')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ period: data });
}

export const GET = withApiRoute(handleGET);
