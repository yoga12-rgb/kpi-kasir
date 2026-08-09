import { createClient } from '@/lib/supabase/server';

function avatarProxyUrl(path: string): string {
  return `/api/storage/cashier-avatar?path=${encodeURIComponent(path)}`;
}

export function avatarPath(cashierId: string, ext: string, version: string): string {
  return `cashier/${cashierId}/avatar-${version}.${ext}`;
}

/**
 * Buat signed URL untuk foto profil kasir.
 * Return null jika kasir tidak punya avatar.
 */
export async function getCashierAvatarUrl(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  avatarPathValue: string | null | undefined
): Promise<string | null> {
  if (!avatarPathValue) return null;
  return avatarProxyUrl(avatarPathValue);
}

/**
 * Buat signed URLs untuk sekumpulan path avatar (dipakai pada daftar kasir,
 * assessment, mentoring) agar tidak N+1 request per kasir.
 */
export async function getCashierAvatarUrls(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  paths: (string | null | undefined)[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const uniquePaths = [...new Set(paths.filter(Boolean) as string[])];

  if (uniquePaths.length === 0) return result;

  for (const path of uniquePaths) {
    result.set(path, avatarProxyUrl(path));
  }

  return result;
}
