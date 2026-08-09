export function getSafeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export function resolveRedirectOrigin(input: {
  requestOrigin: string;
  forwardedHost: string | null;
  forwardedProto: string | null;
  allowedOrigins: string[];
  isDevelopment: boolean;
}) {
  const configured = input.allowedOrigins
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (input.forwardedHost) {
    const host = input.forwardedHost.split(',')[0]?.trim() ?? '';
    const protocol = input.forwardedProto === 'http' ? 'http' : 'https';
    try {
      const candidate = new URL(`${protocol}://${host}`).origin;
      if (configured.includes(candidate)) return candidate;
    } catch {
      // Ignore malformed forwarded host and use the configured request origin.
    }
  }

  if (configured.includes(input.requestOrigin)) return input.requestOrigin;
  if (input.isDevelopment && configured.length === 0) return input.requestOrigin;
  return configured[0] ?? input.requestOrigin;
}
