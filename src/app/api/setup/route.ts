import { createHash, randomUUID } from 'node:crypto';
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

function getServiceKeyDiagnostics() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const kind = serviceKey.startsWith('eyJ')
    ? 'legacy-jwt'
    : serviceKey.startsWith('sb_secret_')
      ? 'secret'
      : serviceKey
        ? 'other'
        : 'missing';

  return {
    configured: serviceKey.length > 0,
    kind,
    length: serviceKey.length,
    fingerprint: serviceKey
      ? createHash('sha256').update(serviceKey).digest('hex').slice(0, 16)
      : null,
  };
}

function logSetupError(stage: string, error: unknown) {
  const value = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};

  console.error(`[setup] ${stage} failed`, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    serviceKey: getServiceKeyDiagnostics(),
    error: {
      code: typeof value.code === 'string' ? value.code : null,
      status:
        typeof value.status === 'number' || typeof value.status === 'string'
          ? value.status
          : null,
      message: typeof value.message === 'string' ? value.message : 'Unknown remote error',
      details: typeof value.details === 'string' ? value.details : null,
      hint: typeof value.hint === 'string' ? value.hint : null,
    },
  });
}

async function releaseSetup(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  claimId: string
) {
  const { error } = await supabase.rpc('release_setup', { p_claim_id: claimId });
  if (error) logSetupError('release_setup', error);
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
    logSetupError('reserve_setup', claimError);
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
    logSetupError('create_user', authError);
    await releaseSetup(supabase, claimId);
    return setupError('Akun admin tidak dapat dibuat. Periksa email dan coba lagi.', 400);
  }

  const userId = authUser.user?.id;
  if (!userId) {
    logSetupError('create_user', new Error('Supabase returned no user ID'));
    await releaseSetup(supabase, claimId);
    return setupError('Akun admin tidak dapat dibuat', 500);
  }

  const { error: finalizeError } = await supabase.rpc('finalize_setup', {
    p_claim_id: claimId,
    p_user_id: userId,
    p_email: parsed.data.email,
    p_full_name: parsed.data.fullName,
  });

  if (finalizeError) {
    logSetupError('finalize_setup', finalizeError);
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      logSetupError('delete_incomplete_user', deleteError);
    } else {
      await releaseSetup(supabase, claimId);
    }
    return setupError('Setup admin gagal diselesaikan, silakan coba lagi.', 500);
  }

  return NextResponse.json({ success: true });
}

export const POST = withApiRoute(handlePOST, {
  publicRoute: true,
  rateLimit: { name: 'setup', limit: 5, windowMs: 60_000 },
});
