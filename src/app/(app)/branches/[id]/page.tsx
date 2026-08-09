import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { OutletForm } from '@/components/outlets/OutletForm';
import { BranchEditForm } from '@/components/branches/BranchEditForm';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { escapeIlike, getPageRange, getTotalPages, parsePage } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';

export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requirePermission('branches.view');
  const permissions = await getRolePermissions(profile.role);
  const canCreateOutlet = profile.role === 'admin' || hasPermission(permissions, 'outlets.create');
  const { id } = await params;
  const listParams = await searchParams;
  const search = listParams?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(listParams?.page);
  const pageSize = 25;
  const { from, to } = getPageRange(page, pageSize);
  const supabase = await createClient();

  const { data: branch } = await supabase
    .from('branch')
    .select('id, name, code, is_active')
    .eq('id', id)
    .single();

  if (!branch) notFound();

  if (profile.role !== 'admin') {
    const { data: userBranch } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id)
      .eq('branch_id', branch.id)
      .maybeSingle();
    if (!userBranch) notFound();
  }

  let outletQuery = supabase
    .from('outlet')
    .select('id, name, is_active, cashier(count)', { count: 'exact' })
    .eq('branch_id', branch.id)
    .order('name')
    .range(from, to);
  if (search) outletQuery = outletQuery.ilike('name', `%${escapeIlike(search)}%`);
  const { data: outlets, count: outletCount } = await outletQuery;

  return (
    <div className="p-4">
      <Link href="/branches" className="text-sm text-primary-600 hover:underline">
        &larr; Kembali
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">{branch.name}</h1>
          <p className="text-sm text-surface-500">
            {branch.code ?? 'Tanpa kode'} &middot; {outletCount ?? 0} outlet
          </p>
        </div>
        {branch.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Nonaktif</Badge>}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-surface-900">Outlet</h2>
        <form method="get" className="mb-3 flex items-end gap-2">
          <label className="min-w-0 flex-1 text-xs font-medium text-surface-500">
            Cari outlet
            <input
              name="q"
              defaultValue={search}
              maxLength={100}
              placeholder="Nama outlet"
              className="input mt-1"
            />
          </label>
          <button type="submit" className="btn btn-secondary h-10 w-10 px-0" aria-label="Cari outlet" title="Cari">
            <Search className="mx-auto h-4 w-4" />
          </button>
        </form>
        <div className="space-y-3">
          {(outlets ?? []).map((outlet) => (
            <Link key={outlet.id} href={`/outlets/${outlet.id}`} className="block">
              <Card className="transition-colors hover:bg-surface-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-surface-900">{outlet.name}</p>
                    <p className="text-sm text-surface-500">
                      {outlet.cashier?.[0]?.count ?? 0} kasir
                    </p>
                  </div>
                  {outlet.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Nonaktif</Badge>}
                </div>
              </Card>
            </Link>
          ))}
          {(outlets ?? []).length === 0 && (
            <p className="text-sm text-surface-500">Belum ada outlet.</p>
          )}
        </div>
        <PaginationControls
          pathname={`/branches/${branch.id}`}
          params={{ q: search || undefined }}
          page={page}
          totalPages={getTotalPages(outletCount, pageSize)}
        />
      </div>

      {profile.role === 'admin' && (
        <>
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-surface-900">Ubah Data Cabang</h2>
            <BranchEditForm
              branchId={branch.id}
              currentName={branch.name}
              currentCode={branch.code}
            />
          </div>
          <div className="mt-6">
            <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Outlet</h2>
            <OutletForm branchId={branch.id} />
          </div>
        </>
      )}
      {profile.role !== 'admin' && canCreateOutlet && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Outlet</h2>
          <OutletForm branchId={branch.id} />
        </div>
      )}
    </div>
  );
}
