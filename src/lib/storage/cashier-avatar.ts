import { createClient } from '@/lib/supabase/server';

const BUCKET = 'cashier-photos';

export function avatarPath(cashierId: string, ext: string): string {
  return `cashier/${cashierId}/avatar.${ext}`;
}

/**
 * Buat signed URL untuk foto profil kasir.
 * Return null jika kasir tidak punya avatar.
 */
export async function getCashierAvatarUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  avatarPathValue: string | null | undefined
): Promise<string | null> {
  if (!avatarPathValue) return null;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(avatarPathValue, 3600); // 1 jam

  return data?.signedUrl ?? null;
}

/**
 * Buat signed URLs untuk sekumpulan path avatar (dipakai pada daftar kasir,
 * assessment, mentoring) agar tidak N+1 request per kasir.
 */
export async function getCashierAvatarUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: (string | null | undefined)[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const uniquePaths = [...new Set(paths.filter(Boolean) as string[])];

  if (uniquePaths.length === 0) return result;

  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(uniquePaths, 3600);

  for (const signed of data ?? []) {
    if (signed.path) {
      result.set(signed.path, signed.signedUrl ?? null);
    }
  }

  return result;
}