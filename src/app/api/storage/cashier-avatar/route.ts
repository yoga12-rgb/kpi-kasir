import { NextResponse } from 'next/server';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { hasPermission } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';
import { avatarETag, ifNoneMatchMatches } from '@/lib/storage/avatar-cache';
import { avatarThumbnailPath } from '@/lib/storage/cashier-avatar';

const BUCKET = 'cashier-photos';
const AVATAR_PATH =
  /^cashier\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar(?:-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\.(jpg|png|webp)$/i;

function avatarError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
      },
    }
  );
}

async function handleGET(request: Request) {
  const currentUser = await getCurrentUser();
  const profile = currentUser?.profile;

  if (!profile || !profile.is_active) {
    return avatarError('Sesi tidak aktif', 401);
  }

  if (profile.role !== 'admin') {
    const permissions = await getRolePermissions(profile.role);
    if (!hasPermission(permissions, 'cashier_photos.view')) {
      return avatarError('Tidak memiliki akses foto kasir', 403);
    }
  }

  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  const variantParam = url.searchParams.get('variant');
  if (variantParam && variantParam !== 'thumbnail') {
    return avatarError('Varian foto tidak valid', 400);
  }
  const wantsThumbnail = variantParam === 'thumbnail';
  if (!path || !AVATAR_PATH.test(path)) {
    return avatarError('Path foto tidak valid', 400);
  }

  const variant = wantsThumbnail ? 'thumbnail' : 'original';
  const isVersionedAvatar =
    /\/avatar-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
      path
    );
  const cacheableVersion = isVersionedAvatar;
  const etag = cacheableVersion ? avatarETag(path, variant) : null;

  if (etag && ifNoneMatchMatches(request.headers.get('if-none-match'), etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        'Cache-Control': 'private, max-age=31536000, immutable',
        Vary: 'Cookie',
      },
    });
  }

  const supabase = await createClient();
  const thumbnailPath = wantsThumbnail ? avatarThumbnailPath(path) : null;
  let { data, error } = await supabase.storage.from(BUCKET).download(thumbnailPath ?? path);
  let usedThumbnailFallback = false;

  // Avatar yang diunggah sebelum thumbnail diterapkan tetap dapat digunakan.
  if (wantsThumbnail && thumbnailPath && (error || !data)) {
    usedThumbnailFallback = true;
    ({ data, error } = await supabase.storage.from(BUCKET).download(path));
  }

  if (error || !data) {
    return avatarError('Foto tidak ditemukan', 404);
  }

  const isImmutableRepresentation = cacheableVersion && !usedThumbnailFallback;
  const responseHeaders = new Headers({
    'Cache-Control': isImmutableRepresentation
      ? 'private, max-age=31536000, immutable'
      : 'private, max-age=60, stale-while-revalidate=60',
    'Content-Type': data.type || 'application/octet-stream',
    Vary: 'Cookie',
  });
  if (isImmutableRepresentation && etag) responseHeaders.set('ETag', etag);

  return new NextResponse(data, {
    headers: responseHeaders,
  });
}

export const GET = withApiRoute(handleGET);
