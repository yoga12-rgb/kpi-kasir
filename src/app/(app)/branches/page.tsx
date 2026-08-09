import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

export default async function BranchesPage() {
  const profile = await requirePermission('branches.view');
  const supabase = await createClient();

  let query = supabase.from('branch').select('*, outlet(count)').order('name');
  if (profile.role !== 'admin') {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    query = query.in(
      'id',
      (userBranches ?? []).map((userBranch) => userBranch.branch_id)
    );
  }

  const { data: branches } = await query;

  return (
    <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900">Cabang</h1>
            <p className="mt-0.5 text-sm text-surface-500">
              {profile.role === 'admin' ? 'Kelola struktur cabang' : 'Cabang yang ditugaskan'}
            </p>
          </div>
          {profile.role === 'admin' && (
            <Link href="/branches/new" className="btn btn-primary flex items-center gap-1">
              <Plus className="h-4 w-4" />
              <span>Tambah</span>
            </Link>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {(branches ?? []).map((branch) => (
            <Link key={branch.id} href={`/branches/${branch.id}`} className="block">
              <Card className="transition-colors hover:bg-surface-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-surface-900">{branch.name}</p>
                    <p className="text-sm text-surface-500">
                      {branch.code ?? '-'} · {branch.outlet?.[0]?.count ?? 0} outlet
                    </p>
                  </div>
                  {branch.is_active ? (
                    <Badge variant="success">Aktif</Badge>
                  ) : (
                    <Badge variant="muted">Nonaktif</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
    </div>
  );
}
