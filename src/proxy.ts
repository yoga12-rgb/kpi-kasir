import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database';

const publicPaths = ['/', '/login', '/setup', '/invite'];
const isPublicPath = (pathname: string) =>
  publicPaths.some((p) => pathname === p || (p === '/invite' && pathname.startsWith('/invite/')));

function markPrivateResponse(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Vary', 'Cookie');
  return response;
}

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Setup wizard hanya tersedia sebelum admin pertama dibuat.
  if (pathname === '/setup') {
    const { data: setup } = await supabase
      .from('app_setup')
      .select('admin_created')
      .limit(1)
      .maybeSingle();

    if (setup?.admin_created) {
      const url = request.nextUrl.clone();
      url.pathname = user ? '/dashboard' : '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (user) {
      return response;
    }

    return response;
  }

  if (isPublicPath(pathname)) {
    if (user && (pathname === '/login' || pathname === '/setup')) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return markPrivateResponse(NextResponse.redirect(url));
  }

  return markPrivateResponse(response);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|logo.png|manifest.webmanifest|sw.js|api).*)',
  ],
};
