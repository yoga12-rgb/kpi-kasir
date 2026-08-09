import { describe, expect, it } from 'vitest';
import { decodeNotificationCursor, encodeNotificationCursor } from '../cursor';

describe('notification cursor', () => {
  it('round-trips the created timestamp and stable id', () => {
    const cursor = { createdAt: '2026-08-09T10:00:00.000Z', id: '40000000-0000-0000-0000-000000000001' };
    expect(decodeNotificationCursor(encodeNotificationCursor(cursor))).toEqual(cursor);
  });

  it('rejects malformed, oversized, or invalid cursors', () => {
    expect(decodeNotificationCursor('not-a-cursor')).toBeNull();
    expect(decodeNotificationCursor('e30')).toBeNull();
    expect(decodeNotificationCursor('a'.repeat(513))).toBeNull();
  });
});
