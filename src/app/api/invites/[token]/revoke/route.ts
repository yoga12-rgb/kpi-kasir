import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { revokeInvite } from '@/lib/invites';
import { withApiRoute } from '@/lib/api/route';

const idSchema = z.string().uuid();

async function handlePOST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const admin = await requireAdmin();
  const { token } = await params;
  const inviteId = idSchema.safeParse(token);
  if (!inviteId.success) {
    return NextResponse.json({ error: 'ID invite tidak valid' }, { status: 400 });
  }

  try {
    const invite = await revokeInvite(inviteId.data, admin.id);
    return NextResponse.json({ invite });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mencabut invite';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withApiRoute(handlePOST);
