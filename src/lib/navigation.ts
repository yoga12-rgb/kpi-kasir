const MAX_RETURN_TO_LENGTH = 2000;

export function getSafeReturnTo(candidate: string | null | undefined, fallback: string): string {
  if (!candidate || candidate.length > MAX_RETURN_TO_LENGTH) return fallback;

  let value = candidate;
  try {
    value = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    value.includes('\r') ||
    value.includes('\n')
  ) {
    return fallback;
  }

  return value;
}

export function withReturnTo(path: string, returnTo: string): string {
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return path;
  return `${path}${path.includes('?') ? '&' : '?'}returnTo=${encodeURIComponent(returnTo)}`;
}

export function buildPath(
  pathname: string,
  params: Record<string, string | null | undefined>
): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) searchParams.set(key, value);
  });
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
