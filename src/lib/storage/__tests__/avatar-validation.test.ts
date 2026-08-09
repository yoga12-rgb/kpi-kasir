import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { validateAvatarBuffer } from '@/lib/storage/avatar-validation';

describe('avatar validation', () => {
  it('rejects non-image bytes even when extension is allowed', async () => {
    await expect(
      validateAvatarBuffer(Buffer.from('not-an-image'), 'jpg', 'image/jpeg')
    ).rejects.toThrow('bukan gambar');
  });

  it('rejects mismatched MIME or format', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();

    await expect(validateAvatarBuffer(png, 'jpg', 'image/jpeg')).rejects.toThrow(
      'Format isi file'
    );
    await expect(validateAvatarBuffer(png, 'png', 'image/gif')).rejects.toThrow('MIME');
  });

  it('accepts a decodable PNG within dimension and size limits', async () => {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: 'white' },
    })
      .png()
      .toBuffer();

    await expect(validateAvatarBuffer(png, 'png', 'image/png')).resolves.toMatchObject({
      format: 'png',
      width: 64,
      height: 64,
    });
  });
});
