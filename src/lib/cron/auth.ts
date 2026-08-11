import { randomUUID, timingSafeEqual } from 'node:crypto';

export function getCronContext(request: Request) {
  const invocationHeader = request.headers.get('x-invocation-id')?.trim();
  const invocationId =
    invocationHeader && /^[A-Za-z0-9._:-]{1,128}$/.test(invocationHeader)
      ? invocationHeader
      : randomUUID();
  const expected = process.env.CRON_SECRET?.trim() ?? '';

  const suppliedHeaders = [request.headers.get('x-cron-secret')?.trim() ?? ''];
  const authorization = request.headers.get('authorization')?.trim() ?? '';
  const bearerMatch = authorization.match(/^Bearer[ ]+(.+)$/i);
  if (bearerMatch?.[1]) suppliedHeaders.push(bearerMatch[1].trim());

  const authorized =
    expected.length > 0 &&
    suppliedHeaders.some((supplied) => {
      if (!supplied) return false;
      const suppliedBuffer = Buffer.from(supplied);
      const expectedBuffer = Buffer.from(expected);
      return (
        suppliedBuffer.length === expectedBuffer.length &&
        timingSafeEqual(suppliedBuffer, expectedBuffer)
      );
    });

  return { authorized, invocationId };
}
