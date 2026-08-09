import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const setupSchema = z.object({
  fullName: z.string().trim().min(2),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8),
});

function setupError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function handlePOST(request: Request) {
  const body = await request.json().catch(() => null);

  const parsed = setupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createAdminClient();
  const claimId = randomUUID();

  const { error: claimError } = await supabase.rpc('reserve_setup', {
    p_claim_id: claimId,
  });
  if (claimError) {
    const message = claimError.message.toLowerCase();
    if (message.includes('sudah selesai')) return setupError('Setup sudah selesai', 409);
    if (message.includes('sedang diproses') || message.includes('terlalu banyak')) {
      return setupError('Setup sedang dibatasi, coba lagi nanti', 429);
    }
    return setupError('Setup tidak dapat dimulai', 500);
  }

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.fullName,
    },
  });

  if (authError) {
    await supabase.rpc('release_setup', { p_claim_id: claimId });
    return setupError('Akun admin tidak dapat dibuat. Periksa email dan coba lagi.', 400);
  }

  const userId = authUser.user?.id;
  if (!userId) {
    await supabase.rpc('release_setup', { p_claim_id: claimId });
    return setupError('Akun admin tidak dapat dibuat', 500);
  }

  const { error: finalizeError } = await supabase.rpc('finalize_setup', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_email: parsed.data.email,
    p_full_name: parsed.data.fullName,
  });

  if (finalizeError) {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (!deleteError) {
      await supabase.rpc('release_setup', { p_claim_id: claimId });
    }
    return setupError('Setup admin gagal diselesaikan, silakan coba lagi.', 500);
  }

  return NextResponse.json({ success: true });
}

export const POST = withApiRoute(handlePOST, {
  publicRoute: true,
  rateLimit: { name: 'setup', limit: 5, windowMs: 60_000 },
});
