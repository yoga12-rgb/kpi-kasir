'use client';

import {
  keepPreviousData,
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Ban, Check, Clipboard, Link as LinkIcon, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Toast } from '@/components/ui/Overlay';
import { appQueryKeys } from '@/lib/client/query-keys';
import { formatDateTime, getErrorMessage } from '@/lib/utils';
import type { Invite, UserRole } from '@/types/database';

interface InviteListItem extends Invite {
  link: string;
  branchNames: string[];
}

interface BranchOption {
  id: string;
  name: string;
}

interface InvitePage {
  items: InviteListItem[];
  nextCursor: string | null;
}

function getInviteStatus(invite: Invite): { label: string; variant: BadgeVariant } {
  if (invite.revoked_at) return { label: 'Dicabut', variant: 'danger' };
  if (invite.accepted_user_id || invite.used_at) {
    return { label: 'Terdaftar', variant: 'success' };
  }
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return { label: 'Kedaluwarsa', variant: 'danger' };
  }
  return { label: 'Belum didaftarkan', variant: 'warning' };
}

function roleLabel(role: UserRole) {
  return role === 'manager' ? 'Manager' : 'Supervisor';
}

function toInviteListItem(invite: Invite, appUrl: string, branches: BranchOption[]): InviteListItem {
  return {
    ...invite,
    link: `${appUrl}/invite/${invite.token}`,
    branchNames: branches
      .filter((branch) => invite.branch_ids.includes(branch.id))
      .map((branch) => branch.name),
  };
}

function mergeInvitePageData(
  data: InfiniteData<InvitePage, string | null> | undefined,
  itemId: string,
  update: (item: InviteListItem) => InviteListItem
) {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.id === itemId ? update(item) : item)),
    })),
  };
}

export function InviteList({ branches, appUrl }: { branches: BranchOption[]; appUrl: string }) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const inviteQuery = useInfiniteQuery<InvitePage, Error>({
    queryKey: appQueryKeys.invites(activeSearch),
    queryFn: async ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (activeSearch) params.set('search', activeSearch);
      if (pageParam) params.set('cursor', pageParam as string);
      const response = await fetch(`/api/invites?${params.toString()}`, { signal });
      const payload = (await response.json().catch(() => null)) as {
        invites?: Invite[];
        nextCursor?: string | null;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal mengambil daftar invite'));
      }
      return {
        items: (payload?.invites ?? []).map((invite) =>
          toInviteListItem(invite, appUrl, branches)
        ),
        nextCursor: payload?.nextCursor ?? null,
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const items = useMemo(() => {
    const seen = new Set<string>();
    return (inviteQuery.data?.pages.flatMap((page) => page.items) ?? []).filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [inviteQuery.data]);

  const revokeMutation = useMutation<InviteListItem, Error, InviteListItem, { previous?: InfiniteData<InvitePage, string | null> }>({
    mutationFn: async (invite) => {
      const response = await fetch(`/api/invites/${invite.id}/revoke`, { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as { invite?: Invite; error?: unknown } | null;
      if (!response.ok || !payload?.invite) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal mencabut invite'));
      }
      return toInviteListItem(payload.invite, appUrl, branches);
    },
    onMutate: async (invite) => {
      await queryClient.cancelQueries({ queryKey: appQueryKeys.invitesRoot });
      const previous = queryClient.getQueryData<InfiniteData<InvitePage, string | null>>(
        appQueryKeys.invites(activeSearch)
      );
      queryClient.setQueryData<InfiniteData<InvitePage, string | null>>(
        appQueryKeys.invites(activeSearch),
        (current) =>
          mergeInvitePageData(current, invite.id, () => ({
            ...invite,
            revoked_at: new Date().toISOString(),
          }))
      );
      return { previous };
    },
    onSuccess: (invite) => {
      queryClient.setQueryData<InfiniteData<InvitePage, string | null>>(
        appQueryKeys.invites(activeSearch),
        (current) => mergeInvitePageData(current, invite.id, () => invite)
      );
      setToast({ message: 'Link undangan dicabut', variant: 'success' });
    },
    onError: (error, _invite, context) => {
      if (context?.previous) {
        queryClient.setQueryData(appQueryKeys.invites(activeSearch), context.previous);
      }
      setToast({ message: error.message, variant: 'error' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.invitesRoot, refetchType: 'none' });
      setActionId(null);
    },
  });

  const regenerateMutation = useMutation<InviteListItem, Error, InviteListItem, { previous?: InfiniteData<InvitePage, string | null> }>({
    mutationFn: async (invite) => {
      const response = await fetch(`/api/invites/${invite.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresInDays: 7 }),
      });
      const payload = (await response.json().catch(() => null)) as {
        invite?: Invite;
        link?: string;
        error?: unknown;
      } | null;
      if (!response.ok || !payload?.invite) {
        throw new Error(getErrorMessage(payload?.error, 'Gagal membuat ulang invite'));
      }
      return toInviteListItem(payload.invite, appUrl, branches);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: appQueryKeys.invitesRoot });
      const previous = queryClient.getQueryData<InfiniteData<InvitePage, string | null>>(
        appQueryKeys.invites(activeSearch)
      );
      return { previous };
    },
    onSuccess: (invite) => {
      queryClient.setQueryData<InfiniteData<InvitePage, string | null>>(
        appQueryKeys.invites(activeSearch),
        (current) => mergeInvitePageData(current, invite.id, () => invite)
      );
      setToast({ message: 'Link undangan baru dibuat', variant: 'success' });
    },
    onError: (error, _invite, context) => {
      if (context?.previous) {
        queryClient.setQueryData(appQueryKeys.invites(activeSearch), context.previous);
      }
      setToast({ message: error.message, variant: 'error' });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.invitesRoot, refetchType: 'none' });
      setActionId(null);
    },
  });

  async function copyLink(invite: InviteListItem) {
    if (invite.revoked_at) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setToast({ message: 'Link gagal disalin', variant: 'error' });
    }
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    setActiveSearch(searchInput.trim());
  }

  function revoke(invite: InviteListItem) {
    if (!window.confirm(`Cabut link undangan untuk ${invite.invite_name}?`)) return;
    setActionId(invite.id);
    revokeMutation.mutate(invite);
  }

  function regenerate(invite: InviteListItem) {
    setActionId(invite.id);
    regenerateMutation.mutate(invite);
  }

  const queryError = inviteQuery.error?.message;

  return (
    <section className="mt-6" aria-labelledby="invite-list-title" aria-busy={inviteQuery.isFetching}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 id="invite-list-title" className="text-lg font-semibold text-surface-900">
            Daftar Link Undangan
          </h3>
          <p className="mt-0.5 text-xs text-surface-500">
            Pantau status, cari, cabut, atau buat ulang link.
          </p>
        </div>
        <span className="text-xs text-surface-400">{items.length} link</span>
      </div>

      <form onSubmit={submitSearch} className="mb-3 flex items-end gap-2">
        <Input
          label="Cari nama undangan"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Nama pengguna"
        />
        <Button type="submit" size="sm" variant="secondary" aria-label="Cari invite" title="Cari">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {queryError && items.length === 0 && (
        <div className="py-6 text-center text-sm text-danger-600">
          <p>{queryError}</p>
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => void inviteQuery.refetch()}>
            Coba lagi
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {items.map((invite) => {
          const status = getInviteStatus(invite);
          const copied = copiedId === invite.id;
          const pending = actionId === invite.id;
          const canRevoke = !invite.used_at && !invite.accepted_user_id && !invite.revoked_at;
          const canRegenerate = !invite.used_at && !invite.accepted_user_id;

          return (
            <Card key={invite.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-surface-900">{invite.invite_name}</p>
                  <p className="mt-0.5 text-xs text-surface-500">
                    {roleLabel(invite.role)} · {invite.branchNames.join(', ') || 'Cabang tidak tersedia'}
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>

              <div className="flex items-center gap-2 text-xs text-surface-400">
                <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                <span>Dibuat {formatDateTime(invite.created_at)}</span>
                <span aria-hidden="true">·</span>
                <span>Berakhir {formatDateTime(invite.expires_at)}</span>
              </div>

              <div className="flex items-center gap-2 border-t border-surface-100 pt-3">
                <p className="min-w-0 flex-1 truncate rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-500">
                  {invite.link}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => copyLink(invite)}
                  disabled={!!invite.revoked_at}
                  aria-label={copied ? 'Link sudah disalin' : `Salin link ${invite.invite_name}`}
                  title={copied ? 'Link sudah disalin' : 'Salin link'}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  <span className="sr-only">{copied ? 'Tersalin' : 'Salin'}</span>
                </Button>
              </div>

              {(canRevoke || canRegenerate) && (
                <div className="flex justify-end gap-2">
                  {canRevoke && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => revoke(invite)} disabled={pending}>
                      <Ban className="h-4 w-4" />
                      Cabut
                    </Button>
                  )}
                  {canRegenerate && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => regenerate(invite)} disabled={pending}>
                      <RefreshCw className="h-4 w-4" />
                      Buat ulang
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {items.length === 0 && !queryError && (
          <div className="rounded-xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-surface-500">
            Belum ada link undangan.
          </div>
        )}
      </div>

      {queryError && items.length > 0 && <p className="mt-3 text-sm text-danger-600">{queryError}</p>}
      {inviteQuery.hasNextPage && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          className="mt-3"
          onClick={() => void inviteQuery.fetchNextPage()}
          disabled={inviteQuery.isFetchingNextPage}
        >
          {inviteQuery.isFetchingNextPage ? 'Memuat...' : 'Muat lebih banyak'}
        </Button>
      )}

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </section>
  );
}
