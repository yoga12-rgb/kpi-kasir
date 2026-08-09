import { describe, expect, it } from 'vitest';
import { getSafeNext, resolveRedirectOrigin } from '@/lib/auth/redirect';

describe('OAuth redirect safety', () => {
  it('keeps only local paths for next', () => {
    expect(getSafeNext('/invite/abc/google')).toBe('/invite/abc/google');
    expect(getSafeNext('https://evil.example')).toBe('/dashboard');
    expect(getSafeNext('//evil.example')).toBe('/dashboard');
  });

  it('uses forwarded host only when it is allowlisted', () => {
    const input = {
      requestOrigin: 'https://internal-proxy',
      forwardedHost: 'app.example.com',
      forwardedProto: 'https',
      allowedOrigins: ['https://app.example.com'],
      isDevelopment: false,
    };
    expect(resolveRedirectOrigin(input)).toBe('https://app.example.com');
    expect(resolveRedirectOrigin({ ...input, forwardedHost: 'evil.example' })).toBe(
      'https://app.example.com'
    );
  });

  it('accepts a configured request origin without forwarded headers', () => {
    expect(
      resolveRedirectOrigin({
        requestOrigin: 'https://app.example.com',
        forwardedHost: null,
        forwardedProto: null,
        allowedOrigins: ['https://app.example.com'],
        isDevelopment: false,
      })
    ).toBe('https://app.example.com');
  });
});
