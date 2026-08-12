import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';

describe('application query keys', () => {
  it('keeps list queries grouped by pathname and filter values', () => {
    expect(appQueryKeys.urlList('/cashiers', ['q=budi', 'page=2'])).toEqual([
      'url-list',
      '/cashiers',
      'q=budi',
      'page=2',
    ]);
  });

  it('invalidates only the requested query root', async () => {
    const queryClient = new QueryClient();
    const cashierKey = appQueryKeys.urlList('/cashiers', ['q=', 'page=']);
    const leaderboardKey = appQueryKeys.leaderboard('global', 'period', 'period-1', '', '', '');

    queryClient.setQueryData(cashierKey, { items: [] });
    queryClient.setQueryData(leaderboardKey, { pages: [], pageParams: [] });

    await invalidateAppQueries(queryClient, [appQueryKeys.urlLists]);

    expect(queryClient.getQueryState(cashierKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(leaderboardKey)?.isInvalidated).toBe(false);
  });
});
