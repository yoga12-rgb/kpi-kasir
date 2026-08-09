import { NextResponse } from 'next/server';
import { getInviteByToken, isInviteValid } from '@/lib/invites';
import { createAdminClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

async function handleGET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: 'Link undangan tidak ditemukan' }, { status: 404 });
  }

  const check = isInviteValid(invite);
  if (!check.valid) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  // Ambil nama cabang untuk ditampilkan
  const supabase = await createAdminClient();
  const { data: branches } = await supabase
    .from('branch')
    .select('id, name')
    .in('id', invite.branch_ids);

  return NextResponse.json({
    invite: {
      name: invite.invite_name,
      role: invite.role,
      branchIds: invite.branch_ids,
      branches: branches ?? [],
    },
  });
}

export const GET = withApiRoute(handleGET, { publicRoute: true });
