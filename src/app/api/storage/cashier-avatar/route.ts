import { NextResponse } from 'next/server';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { hasPermission } from '@/lib/auth/permissions';
import { getCurrentUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { withApiRoute } from '@/lib/api/route';

const BUCKET = 'cashier-photos';
const AVATAR_PATH = /^cashier\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/avatar(?:-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})?\.(jpg|png|webp)$/i;

async function handleGET(request: Request) {
  const currentUser = await getCurrentUser();
  const profile = currentUser?.profile;

  if (!profile || !profile.is_active) {
    return NextResponse.json({ error: 'Sesi tidak aktif' }, { status: 401 });
  }

  if (profile.role !== 'admin') {
    const permissions = await getRolePermissions(profile.role);
    if (!hasPermission(permissions, 'cashier_photos.view')) {
      return NextResponse.json({ error: 'Tidak memiliki akses foto kasir' }, { status: 403 });
    }
  }

  const path = new URL(request.url).searchParams.get('path');
  if (!path || !AVATAR_PATH.test(path)) {
    return NextResponse.json({ error: 'Path foto tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);

  if (error || !data) {
    return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      'Cache-Control': 'private, max-age=60, stale-while-revalidate=60',
      'Content-Type': data.type || 'application/octet-stream',
    },
  });
}

export const GET = withApiRoute(handleGET);
