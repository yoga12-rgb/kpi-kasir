import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createInvite } from '@/lib/invites';
import { requireUser } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/server';

const inviteSchema = z.object({
  inviteName: z.string().trim().min(2).max(100),
  role: z.enum(['manager', 'supervisor']),
  branchIds: z.array(z.string().uuid()).min(1),
  expiresInDays: z.number().int().min(1).max(30).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin yang bisa membuat undangan' }, { status: 403 });
  }

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

export async function GET() {
  const user = await requireUser();
  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Hanya admin' }, { status: 403 });
  }

  const supabase = await createAdminClient();
  const { data } = await supabase
    .from('invite')
    .select('*')
    .order('created_at', { ascending: false });

  return NextResponse.json({ invites: data ?? [] });
}
