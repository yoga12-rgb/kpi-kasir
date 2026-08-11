import { createHash } from 'node:crypto';

export type AvatarCacheVariant = 'original' | 'thumbnail';

/**
 * Builds a validator for an immutable, versioned avatar representation.
 * The variant is part of the key so originals and thumbnails never share an ETag.
 */
export function avatarETag(path: string, variant: AvatarCacheVariant): string {
  const key = `kpi-kasir:cashier-avatar:${variant}:${path}`;
  return `"${createHash('sha256').update(key).digest('hex')}"`;
}

/**
 * If-None-Match uses weak comparison. This accepts both strong and weak forms
 * while keeping the generated response validator strong and deterministic.
 */
export function ifNoneMatchMatches(value: string | null, etag: string): boolean {
  if (!value) return false;

  const normalizedEtag = etag.replace(/^W\//i, '');
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || candidate.replace(/^W\//i, '') === normalizedEtag);
}
