'use client';

import { useEffect, useState } from 'react';
import { InviteForm } from '@/components/invite/InviteForm';
import { InviteList } from '@/components/invite/InviteList';
import { Skeleton } from '@/components/ui/Feedback';
import { getErrorMessage } from '@/lib/utils';
import type { Invite } from '@/types/database';

interface BranchOption {
  id: string;
  name: string;
}

interface InviteListItem extends Invite {
  link: string;
  branchNames: string[];
}

interface InvitePayload {
  invites?: Invite[];
  nextCursor?: string | null;
  error?: unknown;
}

export function InviteTabClient({ appUrl }: { appUrl: string }) {
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [invites, setInvites] = useState<InviteListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const [branchResponse, inviteResponse] = await Promise.all([
          fetch('/api/branches?limit=100', { signal: controller.signal }),
          fetch('/api/invites?limit=20', { signal: controller.signal }),
        ]);
        const branchPayload = await branchResponse.json().catch(() => null);
        const invitePayload = (await inviteResponse
          .json()
          .catch(() => null)) as InvitePayload | null;
        if (!branchResponse.ok) {
          throw new Error(getErrorMessage(branchPayload?.error, 'Gagal memuat cabang'));
        }
        if (!inviteResponse.ok) {
          throw new Error(getErrorMessage(invitePayload?.error, 'Gagal memuat undangan'));
        }

        const branchOptions = (
          (branchPayload?.branches ?? []) as Array<{
            id: string;
            name: string;
            is_active?: boolean;
          }>
        )
          .filter((branch) => branch.is_active !== false)
          .map(({ id, name }) => ({ id, name }));
        const branchNames = new Map(branchOptions.map((branch) => [branch.id, branch.name]));
        const listItems = (invitePayload?.invites ?? []).map((invite) => ({
          ...invite,
          link: `${appUrl}/invite/${invite.token}`,
          branchNames: invite.branch_ids
            .map((branchId) => branchNames.get(branchId))
            .filter((name): name is string => Boolean(name)),
        }));

        if (!controller.signal.aborted) {
          setBranches(branchOptions);
          setInvites(listItems);
          setNextCursor(invitePayload?.nextCursor ?? null);
        }
      } catch (reason: unknown) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(reason, 'Gagal memuat data undangan'));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [appUrl]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-80 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-danger-600">{error}</p>;
  }

  return (
    <>
      <InviteForm branches={branches} />
      <InviteList invites={invites} nextCursor={nextCursor} branches={branches} appUrl={appUrl} />
    </>
  );
}
