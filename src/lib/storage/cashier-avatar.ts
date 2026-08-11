import { createClient } from '@/lib/supabase/server';

type AvatarVariant = 'original' | 'thumbnail';

function avatarProxyUrl(path: string, variant: AvatarVariant = 'original'): string {
  const params = new URLSearchParams({ path });
  if (variant === 'thumbnail') params.set('variant', 'thumbnail');
  return `/api/storage/cashier-avatar?${params.toString()}`;
}

export function avatarPath(cashierId: string, ext: string, version: string): string {
  return `cashier/${cashierId}/avatar-${version}.${ext}`;
}

export function avatarThumbnailPath(path: string): string | null {
  const match = path.match(/^(cashier\/[0-9a-f-]+\/avatar-[0-9a-f-]+)\.(jpg|png|webp)$/i);
  return match ? `${match[1]}-thumb.${match[2]}` : null;
}

/**
 * Buat signed URL untuk foto profil kasir.
 * Return null jika kasir tidak punya avatar.
 */
export async function getCashierAvatarUrl(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  avatarPathValue: string | null | undefined,
  variant: AvatarVariant = 'original'
): Promise<string | null> {
  if (!avatarPathValue) return null;
  return avatarProxyUrl(avatarPathValue, variant);
}

/**
 * List memakai thumbnail privat. Proxy akan fallback ke original untuk avatar
 * lama yang belum memiliki thumbnail, sehingga migrasi tidak merusak foto lama.
 */
export async function getCashierAvatarUrls(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  paths: (string | null | undefined)[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const uniquePaths = [...new Set(paths.filter(Boolean) as string[])];

  if (uniquePaths.length === 0) return result;

  for (const path of uniquePaths) {
    result.set(path, avatarProxyUrl(path, 'thumbnail'));
  }

  return result;
}
