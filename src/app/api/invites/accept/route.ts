import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import {
  consumeInviteRegistration,
  getInviteByToken,
  isInviteValid,
} from '@/lib/invites';
import { withApiRoute } from '@/lib/api/route';

const acceptSchema = z.object({
  token: z.string().min(1),
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2).max(100),
  password: z.string().min(8),
});

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  const invite = await getInviteByToken(parsed.data.token);
  if (!invite) {
    return NextResponse.json({ error: 'Link undangan tidak ditemukan' }, { status: 404 });
  }

  const check = isInviteValid(invite);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const supabase = await createAdminClient();
  const email = parsed.data.email.toLowerCase();

  // Cek email sudah terdaftar?
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Email sudah terdaftar' }, { status: 400 });
  }

  // Buat user di Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
    },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const userId = authUser.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Akun gagal dibuat' }, { status: 500 });
  }

  try {
    await consumeInviteRegistration({
      token: parsed.data.token,
      userId,
      email,
      fullName: parsed.data.fullName,
    });
  } catch (error) {
    await supabase.auth.admin.deleteUser(userId);
    const message = error instanceof Error ? error.message : 'Gagal menyelesaikan pendaftaran';
    const status = message === 'Link undangan sudah digunakan' ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({ success: true });
}

export const POST = withApiRoute(handlePOST, {
  publicRoute: true,
  rateLimit: { name: 'invite-accept', limit: 10, windowMs: 10 * 60_000 },
});
