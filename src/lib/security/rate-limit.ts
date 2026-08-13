export interface RateLimitConfig {
  name: string;
  limit: number;
  windowMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Bound the in-memory store so an attacker cannot exhaust process memory by
 * generating a unique key per request. This is a defensive safeguard only:
 * real distributed rate limiting still requires a shared store (e.g. Upstash)
 * for multi-instance/serverless deployments (see docs/AUDIT_REMEDIATION_ROADMAP.md M0).
 */
export const MAX_BUCKETS = 10_000;

function clientAddress(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return (forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown').slice(0, 128);
}

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(request: Request, config: RateLimitConfig, identity?: string) {
  const now = Date.now();
  const key = `${config.name}:${identity || clientAddress(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    if (!current && buckets.size >= MAX_BUCKETS) {
      sweepExpired(now);
      // Still full after sweeping: evict the oldest entry to stay bounded.
      if (buckets.size >= MAX_BUCKETS) {
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) buckets.delete(oldestKey);
      }
    }
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= config.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimitForTests() {
  buckets.clear();
}