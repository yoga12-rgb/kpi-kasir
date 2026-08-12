import { describe, expect, it } from 'vitest';
import { normalizeIndicatorScores } from '@/lib/leaderboard/indicator-scores';

describe('normalizeIndicatorScores', () => {
  it('returns stable indicator rows from category score JSON', () => {
    expect(
      normalizeIndicatorScores({
        second: { name: 'Akurasi Transaksi', score: 87.5 },
        first: { name: 'Pelayanan', score: 62 },
      })
    ).toEqual([
      { id: 'second', name: 'Akurasi Transaksi', score: 87.5 },
      { id: 'first', name: 'Pelayanan', score: 62 },
    ]);
  });

  it('ignores invalid values and clamps scores to the display range', () => {
    expect(
      normalizeIndicatorScores({
        invalid: { name: '', score: 80 },
        high: { name: 'Kualitas', score: 120 },
        low: { name: 'Kehadiran', score: -10 },
        text: { name: 'Komunikasi', score: '90.5' },
        broken: { name: 'Rusak', score: 'not-a-number' },
      })
    ).toEqual([
      { id: 'low', name: 'Kehadiran', score: 0 },
      { id: 'text', name: 'Komunikasi', score: 90.5 },
      { id: 'high', name: 'Kualitas', score: 100 },
    ]);
  });

  it('returns an empty list for unsupported JSON shapes', () => {
    expect(normalizeIndicatorScores(null)).toEqual([]);
    expect(normalizeIndicatorScores([])).toEqual([]);
    expect(normalizeIndicatorScores('invalid')).toEqual([]);
  });
});
