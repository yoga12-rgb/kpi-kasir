import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import {
  MAX_MENTORING_EVIDENCE_BYTES,
  TARGET_MENTORING_EVIDENCE_BYTES,
} from '@/lib/mentoring/evidence-constants';
import { canonicalizeMentoringEvidence } from '@/lib/storage/mentoring-evidence-validation';

describe('mentoring evidence validation', () => {
  it('creates a bounded WebP and removes metadata', async () => {
    const input = await sharp({
      create: {
        width: 1800,
        height: 1000,
        channels: 3,
        background: { r: 20, g: 120, b: 210 },
      },
    })
      .withMetadata({ orientation: 6, density: 144 })
      .jpeg({ quality: 92 })
      .toBuffer();

    const output = await canonicalizeMentoringEvidence(input, 'image/jpeg');
    const metadata = await sharp(output.buffer).metadata();

    expect(output.mimeType).toBe('image/webp');
    expect(output.byteSize).toBe(output.buffer.length);
    expect(output.byteSize).toBeLessThanOrEqual(MAX_MENTORING_EVIDENCE_BYTES);
    expect(output.byteSize).toBeGreaterThan(0);
    expect(output.width).toBeLessThanOrEqual(1280);
    expect(output.height).toBeLessThanOrEqual(1280);
    expect(output.contentSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(metadata.format).toBe('webp');
    expect(metadata.orientation).toBeUndefined();
  });

  it('rejects invalid signatures and unsupported MIME types', async () => {
    await expect(
      canonicalizeMentoringEvidence(Buffer.from('not-an-image'), 'image/jpeg')
    ).rejects.toMatchObject({
      status: 422,
    });

    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();

    await expect(canonicalizeMentoringEvidence(png, 'image/gif')).rejects.toMatchObject({
      status: 415,
    });
  });

  it('rejects an input above the server transport limit', async () => {
    await expect(
      canonicalizeMentoringEvidence(Buffer.alloc(1024 * 1024 + 1), 'image/jpeg')
    ).rejects.toMatchObject({ status: 413 });
  });

  it('tries to reach the target budget while respecting the hard limit', async () => {
    const input = await sharp({
      create: {
        width: 1280,
        height: 720,
        channels: 3,
        background: { r: 120, g: 80, b: 40 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    const output = await canonicalizeMentoringEvidence(input, 'image/jpeg');

    expect(output.byteSize).toBeLessThanOrEqual(MAX_MENTORING_EVIDENCE_BYTES);
    expect(output.byteSize).toBeLessThanOrEqual(TARGET_MENTORING_EVIDENCE_BYTES);
  });
});
