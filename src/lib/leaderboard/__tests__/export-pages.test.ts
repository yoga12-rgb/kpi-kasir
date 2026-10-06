import { describe, expect, it } from 'vitest';
import {
  collectLeaderboardExportRows,
  LeaderboardExportLimitError,
  LeaderboardExportPaginationError,
} from '@/lib/leaderboard/export-pages';

describe('collectLeaderboardExportRows', () => {
  it('includes rows beyond the 1,000-row query boundary', async () => {
    const source = Array.from({ length: 1001 }, (_, index) => index);
    const cursors: Array<string | null> = [];
    const rows = await collectLeaderboardExportRows(async (cursor) => {
      cursors.push(cursor);
      const start = cursor ? Number(cursor) : 0;
      const pageRows = source.slice(start, start + 999);
      const next = start + pageRows.length;
      return {
        rows: pageRows,
        hasMore: next < source.length,
        nextCursor: next < source.length ? String(next) : null,
      };
    }, 10_000);

    expect(rows).toEqual(source);
    expect(cursors).toEqual([null, '999']);
  });

  it('reports the row limit and invalid cursor instead of returning a partial export', async () => {
    await expect(
      collectLeaderboardExportRows(
        async () => ({ rows: [1, 2], hasMore: false, nextCursor: null }),
        1
      )
    ).rejects.toBeInstanceOf(LeaderboardExportLimitError);
    await expect(
      collectLeaderboardExportRows(async () => ({ rows: [1], hasMore: true, nextCursor: null }), 2)
    ).rejects.toBeInstanceOf(LeaderboardExportPaginationError);
  });
});
