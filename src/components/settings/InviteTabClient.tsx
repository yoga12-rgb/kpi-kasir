'use client';

import { useQuery } from '@tanstack/react-query';
import { InviteForm } from '@/components/invite/InviteForm';
import { InviteList } from '@/components/invite/InviteList';
import { Skeleton } from '@/components/ui/Feedback';
import { appQueryKeys } from '@/lib/client/query-keys';
import { getErrorMessage } from '@/lib/utils';

interface BranchOption {
  id: string;
  name: string;
}

export function InviteTabClient({ appUrl }: { appUrl: string }) {
  const branchesQuery = useQuery<BranchOption[], Error>({
    queryKey: appQueryKeys.inviteBranches,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/branches?limit=100', { signal });
      const payload = (await response.json().catch(() => null)) as {
        branches?: Array<{ id: string; name: string; is_active?: boolean }>;
        error?: unknown;
      } | null;
      if (!response.ok) throw new Error(getErrorMessage(payload?.error, 'Gagal memuat cabang'));
      return (payload?.branches ?? [])
        .filter((branch) => branch.is_active !== false)
        .map(({ id, name }) => ({ id, name }));
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (branchesQuery.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (branchesQuery.error) {
    return <p className="text-sm text-danger-600">{branchesQuery.error.message}</p>;
  }

  const branches = branchesQuery.data ?? [];
  return (
    <>
      <InviteForm branches={branches} />
      <InviteList branches={branches} appUrl={appUrl} />
    </>
  );
}
