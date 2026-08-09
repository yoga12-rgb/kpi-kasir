import { NextResponse } from 'next/server';
import { completeGoogleInvite, getInviteByToken } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';
import { getSafeNext, resolveRedirectOrigin } from '@/lib/auth/redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeNext(searchParams.get('next'));
  const googleInviteMatch = next.match(/^\/invite\/([A-Za-z0-9]+)\/google$/);
  const allowlist = (process.env.APP_ORIGIN_ALLOWLIST ?? process.env.NEXT_PUBLIC_APP_URL ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const redirectOrigin = resolveRedirectOrigin({
    requestOrigin: origin,
    forwardedHost: request.headers.get('x-forwarded-host'),
    forwardedProto: request.headers.get('x-forwarded-proto'),
    allowedOrigins: allowlist,
    isDevelopment: process.env.NODE_ENV === 'development',
  });

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (googleInviteMatch) {
        const token = googleInviteMatch[1];
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const invite = await getInviteByToken(token);
        const metadata = user?.user_metadata as Record<string, unknown> | undefined;
        const googleName = typeof metadata?.full_name === 'string' ? metadata.full_name.trim() : '';

        if (!user?.email || !invite) {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${redirectOrigin}/invite/${token}?error=google_failed`);
        }

        try {
          await completeGoogleInvite({
            token,
            userId: user.id,
            email: user.email,
            fullName: googleName.length >= 2 ? googleName : invite.invite_name,
          });
        } catch {
          await supabase.auth.signOut();
          return NextResponse.redirect(`${redirectOrigin}/invite/${token}?error=google_failed`);
        }

        return NextResponse.redirect(`${redirectOrigin}/dashboard`);
      }

      return NextResponse.redirect(`${redirectOrigin}${next}`);
    }
  }

  return NextResponse.redirect(`${redirectOrigin}/login?error=auth`);
}
