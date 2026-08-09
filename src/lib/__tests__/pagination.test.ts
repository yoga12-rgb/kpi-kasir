import { describe, expect, it } from 'vitest';
import { escapeIlike, getPageRange, getTotalPages, parsePage } from '../pagination';

describe('pagination helpers', () => {
  it('normalizes page input and calculates bounded ranges', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('3')).toBe(3);
    expect(parsePage('999', 10)).toBe(10);
    expect(getPageRange(3, 25)).toEqual({ from: 50, to: 74 });
    expect(getTotalPages(51, 25)).toBe(3);
  });

  it('escapes wildcard characters in ilike filters', () => {
    expect(escapeIlike('  50%_cashier  ')).toBe('50\\%\\_cashier');
  });
});
