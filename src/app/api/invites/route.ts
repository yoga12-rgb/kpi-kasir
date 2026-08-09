import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInvite, decodeInviteCursor, listInvites } from '@/lib/invites';
import { requireAdmin } from '@/lib/auth/guards';
import { withApiRoute } from '@/lib/api/route';

const inviteSchema = z.object({
  inviteName: z.string().trim().min(2).max(100),
  role: z.enum(['manager', 'supervisor']),
  branchIds: z.array(z.string().uuid()).min(1),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

async function handlePOST(request: Request) {
  const user = await requireAdmin();

  const body = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Data tidak valid', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const invite = await createInvite({
      inviteName: parsed.data.inviteName,
      role: parsed.data.role,
      branchIds: parsed.data.branchIds,
      createdBy: user.id,
      expiresInDays: parsed.data.expiresInDays,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const link = `${appUrl}/invite/${invite.token}`;

    return NextResponse.json({ invite, link });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal membuat undangan';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleGET(request: Request) {
  await requireAdmin();
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '20');
  const search = searchParams.get('search') ?? '';
  const cursorValue = searchParams.get('cursor');
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return NextResponse.json({ error: 'Limit tidak valid' }, { status: 400 });
  }

  if (cursorValue && !decodeInviteCursor(cursorValue)) {
    return NextResponse.json({ error: 'Cursor tidak valid' }, { status: 400 });
  }

  try {
    const result = await listInvites({
      limit,
      search,
      cursor: decodeInviteCursor(cursorValue),
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil daftar invite';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST = withApiRoute(handlePOST, {
  rateLimit: { name: 'invite-create', limit: 30, windowMs: 10 * 60_000 },
});
export const GET = withApiRoute(handleGET);
