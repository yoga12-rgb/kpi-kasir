import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { escapeIlike, getPageRange, getTotalPages, parsePage } from '@/lib/pagination';

export default async function BranchesPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requirePermission('branches.view');
  const supabase = await createClient();
  const params = await searchParams;
  const search = params?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(params?.page);
  const pageSize = 25;
  const { from, to } = getPageRange(page, pageSize);

  let query = supabase
    .from('branch')
    .select('*, outlet(count)', { count: 'exact' })
    .order('name')
    .range(from, to);
  if (search) query = query.or(`name.ilike.%${escapeIlike(search)}%,code.ilike.%${escapeIlike(search)}%`);

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

  const { data: branches, count } = await query;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
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

      <form method="get" className="mt-4 flex items-end gap-2">
        <label className="min-w-0 flex-1 text-xs font-medium text-surface-500">
          Cari cabang
          <input
            name="q"
            defaultValue={search}
            maxLength={100}
            placeholder="Nama atau kode cabang"
            className="input mt-1"
          />
        </label>
        <button type="submit" className="btn btn-secondary h-10 w-10 px-0" aria-label="Cari cabang" title="Cari">
          <Search className="mx-auto h-4 w-4" />
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {(branches ?? []).map((branch) => (
          <Link key={branch.id} href={`/branches/${branch.id}`} className="block">
            <Card className="transition-colors hover:bg-surface-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-surface-900">{branch.name}</p>
                  <p className="text-sm text-surface-500">
                    {branch.code ?? '-'} &middot; {branch.outlet?.[0]?.count ?? 0} outlet
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
        {(branches ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-surface-500">Belum ada cabang.</p>
        )}
      </div>

      <PaginationControls
        pathname="/branches"
        params={{ q: search || undefined }}
        page={page}
        totalPages={getTotalPages(count, pageSize)}
      />
    </div>
  );
}
