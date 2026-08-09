'use client';

import { Check, Clipboard, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';
import type { Invite, UserRole } from '@/types/database';

interface InviteListItem extends Invite {
  link: string;
  branchNames: string[];
}

interface InviteListProps {
  invites: InviteListItem[];
}

function getInviteStatus(invite: Invite): { label: string; variant: BadgeVariant } {
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

export function InviteList({ invites }: InviteListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyLink(invite: InviteListItem) {
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopiedId(invite.id);
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      setCopiedId(null);
    }
  }

  return (
    <section className="mt-6" aria-labelledby="invite-list-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h3 id="invite-list-title" className="text-lg font-semibold text-surface-900">
            Daftar Link Undangan
          </h3>
          <p className="mt-0.5 text-xs text-surface-500">
            Pantau link yang sudah dibuat dan status pendaftarannya.
          </p>
        </div>
        <span className="text-xs text-surface-400">{invites.length} link</span>
      </div>

      <div className="space-y-2">
        {invites.map((invite) => {
          const status = getInviteStatus(invite);
          const copied = copiedId === invite.id;

          return (
            <Card key={invite.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-surface-900">{invite.invite_name}</p>
                  <p className="mt-0.5 text-xs text-surface-500">
                    {roleLabel(invite.role)} ·{' '}
                    {invite.branchNames.join(', ') || 'Cabang tidak tersedia'}
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
                  aria-label={copied ? 'Link sudah disalin' : `Salin link ${invite.invite_name}`}
                  title={copied ? 'Link sudah disalin' : 'Salin link'}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
                  <span className="sr-only">{copied ? 'Tersalin' : 'Salin'}</span>
                </Button>
              </div>
            </Card>
          );
        })}

        {invites.length === 0 && (
          <div className="rounded-xl border border-dashed border-surface-200 px-4 py-8 text-center text-sm text-surface-500">
            Belum ada link undangan.
          </div>
        )}
      </div>
    </section>
  );
}
