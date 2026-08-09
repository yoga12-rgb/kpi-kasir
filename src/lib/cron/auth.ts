import { randomUUID, timingSafeEqual } from 'node:crypto';

export function getCronContext(request: Request) {
  const invocationHeader = request.headers.get('x-invocation-id')?.trim();
  const invocationId =
    invocationHeader && /^[A-Za-z0-9._:-]{1,128}$/.test(invocationHeader)
      ? invocationHeader
      : randomUUID();
  const supplied = request.headers.get('x-cron-secret')?.trim() ?? '';
  const expected = process.env.CRON_SECRET?.trim() ?? '';

  let authorized = false;
  if (supplied && expected) {
    const suppliedBuffer = Buffer.from(supplied);
    const expectedBuffer = Buffer.from(expected);
    authorized =
      suppliedBuffer.length === expectedBuffer.length &&
      timingSafeEqual(suppliedBuffer, expectedBuffer);
  }

  return { authorized, invocationId };
}
