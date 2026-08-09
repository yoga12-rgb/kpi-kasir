import { afterEach, describe, expect, it } from 'vitest';
import { checkRateLimit, resetRateLimitForTests } from '../rate-limit';

afterEach(() => resetRateLimitForTests());

describe('rate limit', () => {
  it('limits a client within the configured window', () => {
    const request = new Request('http://localhost/api/setup', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    });
    const config = { name: 'test', limit: 2, windowMs: 60_000 };

    expect(checkRateLimit(request, config).allowed).toBe(true);
    expect(checkRateLimit(request, config).allowed).toBe(true);
    expect(checkRateLimit(request, config)).toMatchObject({ allowed: false });
  });

  it('uses authenticated identity when provided', () => {
    const request = new Request('http://localhost/api/upload');
    const config = { name: 'upload', limit: 1, windowMs: 60_000 };

    expect(checkRateLimit(request, config, 'user-a').allowed).toBe(true);
    expect(checkRateLimit(request, config, 'user-b').allowed).toBe(true);
    expect(checkRateLimit(request, config, 'user-a').allowed).toBe(false);
  });
});
