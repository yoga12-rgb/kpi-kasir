import { notFound, redirect } from 'next/navigation';
import { ImageOff, MessageSquareOff, Store, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { BackLink } from '@/components/navigation/BackLink';
import { MentoringEvidenceGallery } from '@/components/mentoring/MentoringEvidenceGallery';
import { MentoringEvidenceUploadPanel } from '@/components/mentoring/MentoringEvidenceUploadPanel';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { mentoringEvidenceProxyUrl } from '@/lib/storage/mentoring-evidence';
import { formatDate } from '@/lib/utils';
import { getSafeReturnTo } from '@/lib/navigation';

export const dynamic = 'force-dynamic';

export default async function MentoringDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const profile = await requirePermission('mentoring');
  const [{ id }, navigationParams] = await Promise.all([params, searchParams]);
  const backHref = getSafeReturnTo(navigationParams?.returnTo, '/mentoring');
  const supabase = await createClient();

  const [sessionResult, branchAccessResult] = await Promise.all([
    supabase
      .from('mentoring_session')
      .select(
        'id, visited_date, note_outlet, outlet(name, branch_id, branch(name)), conducted_by, conductor:conducted_by(full_name)'
      )
      .eq('id', id)
      .single(),
    profile.role === 'admin'
      ? Promise.resolve({ data: [] as { branch_id: string }[] })
      : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id),
  ]);
  const session = sessionResult.data;

  if (!session) notFound();

  const outlet = session.outlet as unknown as {
    branch_id: string;
    name: string;
    branch?: { name?: string | null } | null;
  };

  // Cek akses non-admin
  if (profile.role !== 'admin') {
    const allowed = ((branchAccessResult.data ?? []) as { branch_id: string }[]).map(
      (assignment) => assignment.branch_id
    );
    if (!allowed.includes(outlet.branch_id)) redirect('/dashboard');
  }

  const [{ data: notes }, { data: evidence, error: evidenceError }] = await Promise.all([
    supabase
      .from('mentoring_cashier_note')
      .select('id, note, cashier(name)')
      .eq('session_id', session.id),
    supabase
      .from('mentoring_evidence')
      .select('id, session_id, sort_order, byte_size, width, height, status')
      .eq('session_id', session.id)
      .eq('status', 'ready')
      .order('sort_order'),
  ]);

  if (evidenceError) throw evidenceError;
  const evidenceItems = (evidence ?? []).map((item) => ({
    id: item.id,
    sortOrder: item.sort_order,
    byteSize: item.byte_size,
    width: item.width,
    height: item.height,
    url: mentoringEvidenceProxyUrl(session.id, item.id),
  }));

  return (
    <div className="p-4">
      <BackLink href={backHref} label="Pendampingan" />

      <h1 className="mt-2 text-xl font-bold text-surface-900">{outlet.name}</h1>
      <p className="text-sm text-surface-500">
        {outlet.branch?.name ? `${outlet.branch.name} · ` : ''}
        {formatDate(session.visited_date)} · oleh{' '}
        {(session.conductor as unknown as { full_name?: string })?.full_name ?? '-'}
      </p>

      {session.note_outlet && (
        <Card className="mt-4">
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-surface-900">
            <Store className="h-4 w-4 text-primary-600" aria-hidden="true" />
            Catatan Outlet
          </h2>
          <p className="text-sm text-surface-700">{session.note_outlet}</p>
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-surface-900">
          <Users className="h-4 w-4 text-primary-600" aria-hidden="true" />
          Catatan per Kasir
        </h2>
        <div className="space-y-3">
          {(notes ?? []).map((note) => (
            <div key={note.id} className="border-b border-surface-100 pb-3 last:border-0">
              <p className="text-sm font-medium text-surface-900">
                {(note.cashier as unknown as { name?: string })?.name ?? 'Kasir'}
              </p>
              <p className="mt-1 text-sm text-surface-600">{note.note}</p>
            </div>
          ))}
          {(notes ?? []).length === 0 && (
            <p className="flex items-center gap-1.5 text-sm text-surface-500">
              <MessageSquareOff className="h-4 w-4 text-surface-400" aria-hidden="true" />
              Tidak ada catatan per kasir.
            </p>
          )}
        </div>
      </Card>
      <MentoringEvidenceGallery evidence={evidenceItems} />
      {process.env.MENTORING_EVIDENCE_UPLOAD_ENABLED === 'true' &&
        (profile.role === 'admin' || profile.id === session.conducted_by) && (
          <MentoringEvidenceUploadPanel
            existingCount={evidenceItems.length}
            sessionId={session.id}
          />
        )}
      {process.env.MENTORING_EVIDENCE_UPLOAD_ENABLED !== 'true' &&
        (profile.role === 'admin' || profile.id === session.conducted_by) && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-surface-400">
            <ImageOff className="h-3.5 w-3.5" aria-hidden="true" />
            Unggah bukti foto belum diaktifkan.
          </p>
        )}
    </div>
  );
}
