import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { getCurrentUser } from '@/lib/auth/session';
import { nowMs } from '@/lib/performance/server';
import { checkRateLimit, type RateLimitConfig } from '@/lib/security/rate-limit';

type ApiHandler = (request: Request, context?: unknown) => Promise<Response>;

function requestId(request: Request) {
  const supplied = request.headers.get('x-request-id')?.trim();
  return supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
}

function errorResponse(
  request: Request,
  code: string,
  message: string,
  status: number,
  id = requestId(request),
  extraHeaders?: HeadersInit
) {
  return NextResponse.json(
    { error: { code, message, requestId: id } },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        'x-request-id': id,
        ...extraHeaders,
      },
    }
  );
}

function isLoginRedirect(error: unknown) {
  if (!isRedirectError(error)) return false;
  const destination = error.digest.split(';')[2] ?? '';
  return destination.startsWith('/login');
}

function statusCode(status: number) {
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 429) return 'RATE_LIMITED';
  return 'BAD_REQUEST';
}

function safeMessage(message: string, status: number) {
  const looksTechnical =
    /duplicate key|violates|pgrst|postgrest|relation .* does not exist|column .* does not exist|permission denied|invalid input syntax|null value in column|syntax error|jwt|fetch failed|supabase/i.test(
      message
    );
  if (status >= 500 || looksTechnical) return 'Permintaan tidak dapat diproses';
  return message;
}

function isMutationMethod(method: string) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function getAllowedOrigins() {
  return (process.env.APP_ORIGIN_ALLOWLIST ?? process.env.NEXT_PUBLIC_APP_URL ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Proteksi CSRF untuk request mutasi berbasis cookie session. Request browser
 * same-origin selalu menyertakan header `Origin`; request lintas-situs (CSRF)
 * akan memiliki `Origin` dari domain asing dan ditolak. Request tanpa `Origin`
 * (tool non-browser / server-to-server) dibiarkan lewat karena tidak membawa
 * cookie session browser.
 */
function isAllowedOrigin(request: Request) {
  const allowed = getAllowedOrigins();
  if (allowed.length === 0) return true;

  const origin = request.headers.get('origin')?.trim();
  const referer = request.headers.get('referer')?.trim();
  let refererOrigin: string | null = null;
  if (referer) {
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      refererOrigin = null;
    }
  }

  const candidate = (origin || refererOrigin || '').replace(/\/$/, '');
  if (!candidate) return true;

  return allowed.includes(candidate);
}

async function normalizeResponse(response: Response, id: string) {
  const headers = new Headers(response.headers);
  headers.set('x-request-id', id);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  if (!payload || typeof payload !== 'object' || !('error' in payload)) {
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const rawError = payload.error;
  const rawMessage =
    typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object' && 'message' in rawError
        ? (rawError as { message?: unknown }).message
        : null;
  const normalizedError = {
    code: statusCode(response.status),
    message: safeMessage(
      typeof rawMessage === 'string' ? rawMessage : 'Permintaan tidak dapat diproses',
      response.status
    ),
    requestId: id,
  };
  const safeContext =
    'invocationId' in payload && typeof payload.invocationId === 'string'
      ? { invocationId: payload.invocationId }
      : {};

  return NextResponse.json(
    { ...safeContext, error: normalizedError },
    { status: response.status, headers }
  );
}

function withServerTiming(response: Response, startedAt: number) {
  if (process.env.PERFORMANCE_DEBUG !== 'true') return response;

  const headers = new Headers(response.headers);
  headers.set('Server-Timing', `app;dur=${(nowMs() - startedAt).toFixed(1)}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function withApiRoute<TContext>(
  handler: (request: Request, context: TContext) => Promise<Response>,
  options?: { publicRoute?: boolean; rateLimit?: RateLimitConfig }
): (request: Request, context: TContext) => Promise<Response>;
export function withApiRoute(
  handler: (request: Request) => Promise<Response>,
  options?: { publicRoute?: boolean; rateLimit?: RateLimitConfig }
): (request: Request) => Promise<Response>;

export function withApiRoute(
  handler: ApiHandler,
  options: { publicRoute?: boolean; rateLimit?: RateLimitConfig } = {}
): ApiHandler {
  return async (request, context) => {
    const startedAt = nowMs();
    const id = requestId(request);
    try {
      let identity: string | undefined;
      if (!options.publicRoute) {
        const user = await getCurrentUser();
        if (!user?.profile?.is_active) {
          return withServerTiming(
            errorResponse(request, 'UNAUTHENTICATED', 'Autentikasi diperlukan', 401, id),
            startedAt
          );
        }
        identity = user.profile.id;
      }
      if (!options.publicRoute && isMutationMethod(request.method) && !isAllowedOrigin(request)) {
        return withServerTiming(
          errorResponse(request, 'FORBIDDEN', 'Origin tidak diizinkan', 403, id),
          startedAt
        );
      }
      if (options.rateLimit) {
        const rate = checkRateLimit(request, options.rateLimit, identity);
        if (!rate.allowed) {
          return withServerTiming(
            errorResponse(
              request,
              'RATE_LIMITED',
              'Terlalu banyak percobaan. Coba lagi nanti.',
              429,
              id,
              { 'Retry-After': String(rate.retryAfterSeconds) }
            ),
            startedAt
          );
        }
      }
      const response = await handler(request, context);
      return withServerTiming(await normalizeResponse(response, id), startedAt);
    } catch (error) {
      if (isRedirectError(error)) {
        return withServerTiming(
          errorResponse(
            request,
            isLoginRedirect(error) ? 'UNAUTHENTICATED' : 'FORBIDDEN',
            isLoginRedirect(error) ? 'Autentikasi diperlukan' : 'Akses ditolak',
            isLoginRedirect(error) ? 401 : 403,
            id
          ),
          startedAt
        );
      }

      console.error(`[api:${id}] unhandled route error`, error);
      return withServerTiming(
        errorResponse(request, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server', 500, id),
        startedAt
      );
    }
  };
}
