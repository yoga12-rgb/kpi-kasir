import { describe, expect, it } from 'vitest';
import { buildPath, getSafeReturnTo, withReturnTo } from '@/lib/navigation';

describe('navigation helpers', () => {
  it('accepts internal return paths and rejects external destinations', () => {
    expect(getSafeReturnTo('/cashiers?q=budi&page=2', '/dashboard')).toBe(
      '/cashiers?q=budi&page=2'
    );
    expect(getSafeReturnTo('https://example.com', '/dashboard')).toBe('/dashboard');
    expect(getSafeReturnTo('//example.com', '/dashboard')).toBe('/dashboard');
    expect(getSafeReturnTo('/\\example.com', '/dashboard')).toBe('/dashboard');
  });

  it('encodes a return path without changing the destination path', () => {
    expect(withReturnTo('/cashiers/1', '/leaderboard?search=budi')).toBe(
      '/cashiers/1?returnTo=%2Fleaderboard%3Fsearch%3Dbudi'
    );
  });

  it('builds query paths without empty values', () => {
    expect(buildPath('/mentoring', { branchId: 'branch-1', outletId: '', page: null })).toBe(
      '/mentoring?branchId=branch-1'
    );
  });
});
