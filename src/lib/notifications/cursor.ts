import { z } from 'zod';

const cursorSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export interface NotificationCursor {
  createdAt: string;
  id: string;
}

export function encodeNotificationCursor(cursor: NotificationCursor) {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeNotificationCursor(value: string | null | undefined): NotificationCursor | null {
  if (!value || value.length > 512) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    const result = cursorSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
