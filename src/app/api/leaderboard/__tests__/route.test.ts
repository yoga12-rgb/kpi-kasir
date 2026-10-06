import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  branchFilters: [] as Array<{ table: string; value: string }>,
  periodStatus: 'closed' as 'open' | 'closed',
}));

vi.mock('@/lib/api/route', () => ({ withApiRoute: (handler: unknown) => handler }));
vi.mock('@/lib/auth/guards', () => ({
  requirePermission: async () => ({ role: 'admin', id: 'admin' }),
}));
vi.mock('@/lib/storage/cashier-avatar', () => ({
  getCashierAvatarUrls: async () => new Map(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from(table: string) {
      const query = {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          if (column === 'branch_id' || column === 'cashier.outlet.branch_id') {
            mock.branchFilters.push({ table, value });
          }
          return this;
        },
        in() {
          return this;
        },
        order() {
          return this;
        },
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({
          data:
            table === 'period'
              ? { id: PERIOD_ID, label: '2026-10', status: mock.periodStatus }
              : null,
        }),
        then(resolve: (value: { data: { id: string }[] }) => void) {
          resolve({ data: table === 'branch' ? [{ id: BRANCH_ID }] : [] });
        },
      };
      return query;
    },
  }),
}));

import { GET } from '../route';

const PERIOD_ID = '00000000-0000-4000-8000-000000000001';
const BRANCH_ID = '00000000-0000-4000-8000-000000000002';

describe('GET /api/leaderboard outlet scope', () => {
  beforeEach(() => {
    mock.branchFilters.length = 0;
    mock.periodStatus = 'closed';
  });

  it.each([
    ['closed period', 'period', 'closed', 'leaderboard_entry'],
    ['open period', 'period', 'open', 'cashier_period_score'],
    ['cumulative', 'cumulative', 'closed', 'cashier_cumulative_score'],
  ] as const)(
    'filters the selected branch across all outlets for %s',
    async (_, mode, status, table) => {
      mock.periodStatus = status;
      const url = new URL('http://localhost/api/leaderboard');
      url.searchParams.set('level', 'outlet');
      url.searchParams.set('mode', mode);
      url.searchParams.set('branchId', BRANCH_ID);
      url.searchParams.set('periodId', PERIOD_ID);

      const response = await GET(new Request(url), undefined);

      expect(response.status).toBe(200);
      expect(mock.branchFilters).toContainEqual({ table, value: BRANCH_ID });
    }
  );
});
