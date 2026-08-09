import { NextResponse } from 'next/server';
import { completeGoogleInvite, getInviteByToken } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

function getRedirectOrigin(request: Request, origin: string) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';

  if (isLocalEnv || !forwardedHost) return origin;
  return `https://${forwardedHost}`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = getSafeNext(searchParams.get('next'));
  const googleInviteMatch = next.match(/^\/invite\/([A-Za-z0-9]+)\/google$/);
  const redirectOrigin = getRedirectOrigin(request, origin);

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
