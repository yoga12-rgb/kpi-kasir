import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/guards';
import { regenerateInvite } from '@/lib/invites';
import { withApiRoute } from '@/lib/api/route';

const idSchema = z.string().uuid();
const bodySchema = z.object({
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

async function handlePOST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const admin = await requireAdmin();
  const { token } = await params;
  const inviteId = idSchema.safeParse(token);
  if (!inviteId.success) {
    return NextResponse.json({ error: 'ID invite tidak valid' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data regenerasi tidak valid' }, { status: 400 });
  }

  try {
    const invite = await regenerateInvite({
      inviteId: inviteId.data,
      actorId: admin.id,
      expiresInDays: parsed.data.expiresInDays,
    });
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    return NextResponse.json({ invite, link: `${appUrl}/invite/${invite.token}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat ulang invite';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export const POST = withApiRoute(handlePOST);
