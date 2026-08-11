import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { avatarPath, avatarThumbnailPath } from '@/lib/storage/cashier-avatar';
import { MAX_AVATAR_SIZE, validateAvatarBuffer } from '@/lib/storage/avatar-validation';
import { withApiRoute } from '@/lib/api/route';

const BUCKET = 'cashier-photos';
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const THUMBNAIL_SIZE = 160;

async function getCashierBranch(
  adminSupabase: Awaited<ReturnType<typeof createAdminClient>>,
  id: string
) {
  return adminSupabase
    .from('cashier')
    .select('id, avatar_url, outlet!inner(branch_id)')
    .eq('id', id)
    .single();
}

async function hasBranchAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  branchId: string
) {
  const { data } = await supabase
    .from('user_branch')
    .select('branch_id')
    .eq('user_id', userId)
    .eq('branch_id', branchId)
    .maybeSingle();
  return Boolean(data);
}

async function handlePOST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAnyPermission(['cashier_photos.create', 'cashier_photos.update']);
  const permissions = await getRolePermissions(profile.role);
  const canCreate = profile.role === 'admin' || hasPermission(permissions, 'cashier_photos.create');
  const canUpdate = profile.role === 'admin' || hasPermission(permissions, 'cashier_photos.update');
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return NextResponse.json({ error: 'Ukuran file maksimal 2 MB' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: 'Format harus jpg, png, atau webp' }, { status: 400 });
  }
  let decoded: { buffer: Buffer; format: string };
  try {
    decoded = await validateAvatarBuffer(
      Buffer.from(await file.arrayBuffer()),
      ext === 'jpeg' ? 'jpg' : ext,
      file.type
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'File gambar tidak valid' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const adminSupabase = await createAdminClient();
  const { data: cashier, error: cashierError } = await getCashierBranch(adminSupabase, id);

  if (cashierError || !cashier) {
    return NextResponse.json({ error: 'Kasir tidak ditemukan' }, { status: 404 });
  }

  const branchId = (cashier.outlet as unknown as { branch_id: string }).branch_id;
  if (profile.role !== 'admin' && !(await hasBranchAccess(supabase, profile.id, branchId))) {
    return NextResponse.json({ error: 'Tidak punya akses ke cabang kasir ini' }, { status: 403 });
  }

  if (cashier.avatar_url ? !canUpdate : !canCreate) {
    return NextResponse.json(
      {
        error: cashier.avatar_url
          ? 'Tidak memiliki izin mengganti foto'
          : 'Tidak memiliki izin upload foto',
      },
      { status: 403 }
    );
  }

  const { data: oldObjects } = await adminSupabase.storage
    .from(BUCKET)
    .list(`cashier/${id}`, { limit: 50, search: 'avatar' });
  const oldPaths = (oldObjects ?? [])
    .filter((object) => /^avatar(?:-[0-9a-f-]+)?(?:-thumb)?\.(jpg|png|webp)$/i.test(object.name))
    .map((object) => `cashier/${id}/${object.name}`);

  const path = avatarPath(id, decoded.format, randomUUID());
  const thumbnailPath = avatarThumbnailPath(path);
  if (!thumbnailPath) {
    return NextResponse.json({ error: 'Path foto tidak valid' }, { status: 500 });
  }

  const thumbnailPipeline = sharp(decoded.buffer)
    .rotate()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover', position: 'attention' });
  if (decoded.format === 'jpg') thumbnailPipeline.jpeg({ quality: 82, mozjpeg: true });
  if (decoded.format === 'png') thumbnailPipeline.png({ compressionLevel: 9 });
  if (decoded.format === 'webp') thumbnailPipeline.webp({ quality: 82 });
  const thumbnailBuffer = await thumbnailPipeline.toBuffer();
  const contentType = decoded.format === 'jpg' ? 'image/jpeg' : `image/${decoded.format}`;
  const [photoUpload, thumbnailUpload] = await Promise.all([
    supabase.storage.from(BUCKET).upload(path, decoded.buffer, {
      cacheControl: '31536000',
      upsert: false,
      contentType,
    }),
    supabase.storage.from(BUCKET).upload(thumbnailPath, thumbnailBuffer, {
      cacheControl: '31536000',
      upsert: false,
      contentType,
    }),
  ]);

  if (photoUpload.error || thumbnailUpload.error) {
    const uploadedPaths = [
      ...(photoUpload.error ? [] : [path]),
      ...(thumbnailUpload.error ? [] : [thumbnailPath]),
    ];
    if (uploadedPaths.length > 0) await adminSupabase.storage.from(BUCKET).remove(uploadedPaths);
    return NextResponse.json(
      { error: photoUpload.error?.message ?? thumbnailUpload.error?.message ?? 'Gagal mengunggah foto' },
      { status: 400 }
    );
  }

  const { error: updateError } = await adminSupabase
    .from('cashier')
    .update({ avatar_url: path })
    .eq('id', id);

  if (updateError) {
    await adminSupabase.storage.from(BUCKET).remove([path, thumbnailPath]);
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const pathsToRemove = oldPaths.filter((oldPath) => oldPath !== path);
  if (pathsToRemove.length > 0) {
    const { error: cleanupError } = await adminSupabase.storage.from(BUCKET).remove(pathsToRemove);
    if (cleanupError) console.error('Avatar cleanup failed', cleanupError);
  }

  return NextResponse.json({ avatarUrl: path });
}

export const POST = withApiRoute(handlePOST, {
  rateLimit: { name: 'cashier-avatar', limit: 20, windowMs: 15 * 60_000 },
});
