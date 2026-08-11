import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function MentoringDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('mentoring');
  const { id } = await params;
  const supabase = await createClient();

  const [sessionResult, branchAccessResult] = await Promise.all([
    supabase
      .from('mentoring_session')
      .select('id, visited_date, note_outlet, outlet(name, branch_id), conducted_by(full_name)')
      .eq('id', id)
      .single(),
    profile.role === 'admin'
      ? Promise.resolve({ data: [] as { branch_id: string }[] })
      : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id),
  ]);
  const session = sessionResult.data;

  if (!session) notFound();

  const outlet = session.outlet as unknown as { branch_id: string; name: string };

  // Cek akses non-admin
  if (profile.role !== 'admin') {
    const allowed = ((branchAccessResult.data ?? []) as { branch_id: string }[]).map(
      (assignment) => assignment.branch_id
    );
    if (!allowed.includes(outlet.branch_id)) redirect('/dashboard');
  }

  const { data: notes } = await supabase
    .from('mentoring_cashier_note')
    .select('id, note, cashier(name)')
    .eq('session_id', session.id);

  return (
    <div className="p-4">
        <Link
          href="/mentoring"
          className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Pendampingan</span>
        </Link>

        <h1 className="mt-2 text-xl font-bold text-surface-900">{outlet.name}</h1>
        <p className="text-sm text-surface-500">
          {formatDate(session.visited_date)} · oleh{' '}
          {(session.conducted_by as unknown as { full_name?: string })?.full_name ?? '-'}
        </p>

        {session.note_outlet && (
          <Card className="mt-4">
            <h2 className="mb-2 text-base font-semibold text-surface-900">Catatan Outlet</h2>
            <p className="text-sm text-surface-700">{session.note_outlet}</p>
          </Card>
        )}

        <Card className="mt-4">
          <h2 className="mb-3 text-base font-semibold text-surface-900">Catatan per Kasir</h2>
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
              <p className="text-sm text-surface-500">Tidak ada catatan per kasir.</p>
            )}
          </div>
        </Card>
    </div>
  );
}
