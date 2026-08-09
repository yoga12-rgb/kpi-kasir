import { z } from 'zod';

const leaderboardCursorSchema = z.object({
  score: z.number().finite(),
  cashierId: z.string().uuid(),
  rank: z.number().int().nonnegative(),
});

export interface LeaderboardCursor {
  score: number;
  cashierId: string;
  rank: number;
}

export function encodeLeaderboardCursor(cursor: LeaderboardCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeLeaderboardCursor(value: string): LeaderboardCursor | null {
  try {
    const parsed = leaderboardCursorSchema.safeParse(
      JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
