import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const appQueryKeys = {
  urlLists: ['url-list'] as const,
  urlList: (pathname: string, filters: readonly string[]) =>
    ['url-list', pathname, ...filters] as const,
  cashierTabs: (cashierId: string, tab?: string) =>
    tab ? (['cashier-tabs', cashierId, tab] as const) : (['cashier-tabs', cashierId] as const),
  rolePermissions: ['role-permissions'] as const,
  notifications: ['notifications'] as const,
  cashierTabsRoot: ['cashier-tabs'] as const,
  leaderboardRoot: ['leaderboard'] as const,
  mentoringSessionsRoot: ['mentoring-sessions'] as const,
  invitesRoot: ['invites'] as const,
  inviteBranches: ['invite-branches'] as const,
  leaderboard: (level: string, mode: string, periodId: string, branchId: string, outletId: string, search: string) =>
    ['leaderboard', level, mode, periodId, branchId, outletId, search] as const,
  mentoringSessions: (branchId: string, outletId: string, from: string, to: string) =>
    ['mentoring-sessions', branchId, outletId, from, to] as const,
  invites: (search: string) => ['invites', search] as const,
};

export function invalidateAppQueries(queryClient: QueryClient, queryKeys: readonly QueryKey[]) {
  return Promise.all(
    queryKeys.map((queryKey) =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'none' })
    )
  );
}
