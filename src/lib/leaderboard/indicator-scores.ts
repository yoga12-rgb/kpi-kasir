export interface LeaderboardIndicatorScore {
  id: string;
  name: string;
  score: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Converts the persisted category_scores JSON into a stable, UI-safe list.
 * Invalid entries are ignored so one malformed snapshot cannot break the card.
 */
export function normalizeIndicatorScores(value: unknown): LeaderboardIndicatorScore[] {
  if (!isRecord(value)) return [];

  return Object.entries(value)
    .flatMap(([id, rawValue]) => {
      if (!isRecord(rawValue) || typeof rawValue.name !== 'string') return [];

      const score = typeof rawValue.score === 'number' ? rawValue.score : Number(rawValue.score);
      const name = rawValue.name.trim();
      if (!name || !Number.isFinite(score)) return [];

      return [{ id, name, score: Math.max(0, Math.min(100, score)) }];
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
