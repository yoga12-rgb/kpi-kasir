import sharp from 'sharp';

export const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const ALLOWED_EXT = new Set(['jpg', 'png', 'webp']);
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function validateAvatarBuffer(
  buffer: Buffer,
  extension: string,
  mimeType?: string
) {
  if (buffer.length > MAX_AVATAR_SIZE) throw new Error('Ukuran file maksimal 2 MB');
  if (!ALLOWED_EXT.has(extension)) throw new Error('Format file tidak didukung');
  if (mimeType && !ALLOWED_MIME.has(mimeType)) throw new Error('MIME file tidak valid');

  const signature = buffer.subarray(0, 12);
  const hasJpegSignature = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const hasPngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).equals(
    signature.subarray(0, 8)
  );
  const hasWebpSignature =
    signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
    signature.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!hasJpegSignature && !hasPngSignature && !hasWebpSignature) {
    throw new Error('Isi file bukan gambar yang valid');
  }

  const metadata = await sharp(buffer, {
    failOn: 'error',
    limitInputPixels: 16_777_216,
  }).metadata();
  const format = metadata.format === 'jpeg' ? 'jpg' : metadata.format;
  if (!format || !ALLOWED_EXT.has(format) || extension !== format) {
    throw new Error('Format isi file tidak sesuai dengan extension');
  }
  if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) {
    throw new Error('Dimensi gambar tidak valid');
  }

  return { buffer, format, width: metadata.width, height: metadata.height };
}
