import { describe, expect, it } from 'vitest';
import { decodeLeaderboardCursor, encodeLeaderboardCursor } from '../cursor';

const cursor = {
  score: 87.5,
  cashierId: '40000000-0000-0000-0000-000000000001',
  rank: 25,
};

describe('leaderboard cursor', () => {
  it('round-trips score, tie-breaker, and rank position', () => {
    expect(decodeLeaderboardCursor(encodeLeaderboardCursor(cursor))).toEqual(cursor);
  });

  it('rejects malformed or unsafe cursors', () => {
    expect(decodeLeaderboardCursor('not-a-cursor')).toBeNull();
    expect(
      decodeLeaderboardCursor(
        Buffer.from(JSON.stringify({ score: 80, cashierId: 'not-uuid', rank: 1 })).toString(
          'base64url'
        )
      )
    ).toBeNull();
  });
});
