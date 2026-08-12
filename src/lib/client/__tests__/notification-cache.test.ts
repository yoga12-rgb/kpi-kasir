import { describe, expect, it } from 'vitest';
import { markNotificationReadInPages } from '@/lib/client/notification-cache';

describe('notification query cache', () => {
  it('updates the global unread count when an item on a later page is read', () => {
    const pages = [
      { notifications: [{ id: 'first', is_read: false }], unreadCount: 2 },
      { notifications: [{ id: 'second', is_read: false }], unreadCount: 2 },
    ];

    const updated = markNotificationReadInPages(pages, 'second');

    expect(updated[0]?.unreadCount).toBe(1);
    expect(updated[1]?.notifications[0]?.is_read).toBe(true);
  });

  it('does not decrement the unread count twice', () => {
    const pages = [
      { notifications: [{ id: 'first', is_read: true }], unreadCount: 0 },
    ];

    expect(markNotificationReadInPages(pages, 'first')).toBe(pages);
  });
});
