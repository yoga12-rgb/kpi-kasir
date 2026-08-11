import { describe, expect, it } from 'vitest';
import {
  avatarPath,
  avatarThumbnailPath,
  getCashierAvatarUrls,
} from '@/lib/storage/cashier-avatar';

const cashierId = '2ce2c705-d375-4030-b7b3-1b8f29fcb474';
const version = '9d643793-d0c1-4d4c-9c47-1ab533d4ea3a';

describe('cashier avatar paths', () => {
  it('derives a versioned thumbnail only for versioned avatar paths', () => {
    const path = avatarPath(cashierId, 'jpg', version);

    expect(avatarThumbnailPath(path)).toBe(`cashier/${cashierId}/avatar-${version}-thumb.jpg`);
    expect(avatarThumbnailPath(`cashier/${cashierId}/avatar.jpg`)).toBeNull();
  });

  it('uses one thumbnail proxy URL per distinct list avatar path', async () => {
    const path = avatarPath(cashierId, 'webp', version);
    const urls = await getCashierAvatarUrls(null as never, [path, path, null]);
    const url = urls.get(path);

    expect(urls).toHaveLength(1);
    expect(url).toBeTruthy();
    const parsed = new URL(url!, 'https://example.test');
    expect(parsed.pathname).toBe('/api/storage/cashier-avatar');
    expect(parsed.searchParams.get('path')).toBe(path);
    expect(parsed.searchParams.get('variant')).toBe('thumbnail');
  });
});
