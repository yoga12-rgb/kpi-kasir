import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/server';

const setupSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();

  // Cek apakah setup sudah selesai
  const { data: setup } = await supabase
    .from('app_setup')
    .select('admin_created')
    .limit(1)
    .maybeSingle();

  if (setup?.admin_created) {
    return NextResponse.json({ error: 'Setup sudah selesai' }, { status: 400 });
  }

  // Buat user admin di Supabase Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Update profil role admin + set app_setup
  const userId = authUser.user!.id;

  const { error: profileError } = await supabase
    .from('users')
    .update({ role: 'admin', full_name: parsed.data.fullName })
    .eq('id', userId);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: setupError } = await supabase
    .from('app_setup')
    .update({ admin_created: true, completed_at: new Date().toISOString() })
    .eq('id', '00000000-0000-0000-0000-000000000001');

  if (setupError) {
    return NextResponse.json({ error: setupError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}