import { createHash } from 'node:crypto';
import sharp, { type Metadata, type OutputInfo } from 'sharp';
import {
  MAX_MENTORING_EVIDENCE_BYTES,
  MAX_MENTORING_EVIDENCE_DIMENSION,
  MAX_MENTORING_EVIDENCE_INPUT_BYTES,
  MENTORING_EVIDENCE_ALLOWED_INPUT_MIME,
  TARGET_MENTORING_EVIDENCE_BYTES,
} from '@/lib/mentoring/evidence-constants';

const MAX_INPUT_PIXELS = 16_777_216;
const MAX_INPUT_DIMENSION = 8192;

type EvidenceValidationStatus = 400 | 413 | 415 | 422;

export class MentoringEvidenceValidationError extends Error {
  readonly status: EvidenceValidationStatus;

  constructor(message: string, status: EvidenceValidationStatus = 422) {
    super(message);
    this.name = 'MentoringEvidenceValidationError';
    this.status = status;
  }
}

export interface CanonicalMentoringEvidence {
  buffer: Buffer;
  byteSize: number;
  contentSha256: string;
  height: number;
  mimeType: 'image/webp';
  width: number;
}

function hasSupportedSignature(buffer: Buffer) {
  const signature = buffer.subarray(0, 12);
  const jpeg = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff;
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).equals(signature.subarray(0, 8));
  const webp =
    signature.subarray(0, 4).toString('ascii') === 'RIFF' &&
    signature.subarray(8, 12).toString('ascii') === 'WEBP';
  return jpeg || png || webp;
}

function isAllowedMimeType(mimeType: string | undefined) {
  return (
    !mimeType || (MENTORING_EVIDENCE_ALLOWED_INPUT_MIME as readonly string[]).includes(mimeType)
  );
}

function inputError(message: string): never {
  throw new MentoringEvidenceValidationError(message, 400);
}

async function readInputMetadata(buffer: Buffer) {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    }).metadata();
  } catch {
    throw new MentoringEvidenceValidationError('File gambar tidak valid', 422);
  }

  if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) {
    throw new MentoringEvidenceValidationError('Format gambar tidak didukung', 415);
  }
  if (metadata.pages && metadata.pages > 1) {
    throw new MentoringEvidenceValidationError('Foto animasi tidak didukung', 415);
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_INPUT_DIMENSION ||
    metadata.height > MAX_INPUT_DIMENSION
  ) {
    throw new MentoringEvidenceValidationError('Dimensi gambar tidak valid', 422);
  }

  return metadata;
}

export async function canonicalizeMentoringEvidence(
  input: Buffer,
  mimeType?: string
): Promise<CanonicalMentoringEvidence> {
  if (input.length === 0) inputError('File gambar kosong');
  if (input.length > MAX_MENTORING_EVIDENCE_INPUT_BYTES) {
    throw new MentoringEvidenceValidationError('Ukuran file maksimal 1 MB', 413);
  }
  if (!isAllowedMimeType(mimeType)) {
    throw new MentoringEvidenceValidationError('Format file tidak didukung', 415);
  }
  if (!hasSupportedSignature(input)) {
    throw new MentoringEvidenceValidationError('Isi file bukan gambar yang valid', 422);
  }

  await readInputMetadata(input);

  const attempts = [
    { dimension: 1280, quality: 78 },
    { dimension: 1280, quality: 70 },
    { dimension: 1280, quality: 62 },
    { dimension: 1152, quality: 62 },
    { dimension: 1024, quality: 60 },
    { dimension: 896, quality: 58 },
    { dimension: 720, quality: 55 },
  ];
  let accepted: { buffer: Buffer; height: number; width: number } | null = null;

  for (const attempt of attempts) {
    let result: { data: Buffer; info: OutputInfo };
    try {
      result = await sharp(input, {
        failOn: 'error',
        limitInputPixels: MAX_INPUT_PIXELS,
      })
        .rotate()
        .resize({
          width: attempt.dimension,
          height: attempt.dimension,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          effort: 4,
          quality: attempt.quality,
          smartSubsample: true,
        })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new MentoringEvidenceValidationError('Gambar tidak dapat dikompres', 422);
    }

    const candidate = {
      buffer: result.data,
      height: result.info.height,
      width: result.info.width,
    };
    if (candidate.buffer.length <= TARGET_MENTORING_EVIDENCE_BYTES) {
      accepted = candidate;
      break;
    }
    if (!accepted && candidate.buffer.length <= MAX_MENTORING_EVIDENCE_BYTES) {
      accepted = candidate;
    }
  }

  if (!accepted) {
    throw new MentoringEvidenceValidationError(
      'Foto terlalu kompleks untuk dikompres di bawah 350 KB',
      422
    );
  }
  if (
    accepted.width < 1 ||
    accepted.height < 1 ||
    accepted.width > MAX_MENTORING_EVIDENCE_DIMENSION ||
    accepted.height > MAX_MENTORING_EVIDENCE_DIMENSION ||
    accepted.buffer.length > MAX_MENTORING_EVIDENCE_BYTES
  ) {
    throw new MentoringEvidenceValidationError('Hasil kompresi foto tidak valid', 422);
  }

  return {
    buffer: accepted.buffer,
    byteSize: accepted.buffer.length,
    contentSha256: createHash('sha256').update(accepted.buffer).digest('hex'),
    height: accepted.height,
    mimeType: 'image/webp',
    width: accepted.width,
  };
}
