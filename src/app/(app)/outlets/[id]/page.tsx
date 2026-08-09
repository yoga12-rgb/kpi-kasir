import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CashierForm } from '@/components/cashiers/CashierForm';
import { OutletEditForm } from '@/components/outlets/OutletEditForm';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { escapeIlike, getPageRange, getTotalPages, parsePage } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { formatEmploymentDuration } from '@/lib/utils';

export default async function OutletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const profile = await requireAnyPermission([
    'branches.view',
    'outlets.view',
    'outlets.update',
    'cashiers.view',
  ]);
  const permissions = await getRolePermissions(profile.role);
  const canViewCashiers = profile.role === 'admin' || hasPermission(permissions, 'cashiers.view');
  const canCreateCashiers =
    profile.role === 'admin' || hasPermission(permissions, 'cashiers.create');
  const canUpdateOutlet = profile.role === 'admin' || hasPermission(permissions, 'outlets.update');
  const { id } = await params;
  const listParams = await searchParams;
  const search = listParams?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(listParams?.page);
  const pageSize = 25;
  const { from, to } = getPageRange(page, pageSize);
  const supabase = await createClient();

  const { data: outlet } = await supabase
    .from('outlet')
    .select('id, branch_id, name, is_active, branch(name)')
    .eq('id', id)
    .single();

  if (!outlet) notFound();

  if (profile.role !== 'admin') {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    const allowed = (ub ?? []).map((item) => item.branch_id);
    if (!allowed.includes(outlet.branch_id)) redirect('/dashboard');
  }

  const branch = Array.isArray(outlet.branch) ? outlet.branch[0] : outlet.branch;

  let cashierCount = 0;
  let cashiers: {
    id: string;
    name: string;
    employment_start_date: string;
    is_active: boolean;
  }[] = [];
  if (canViewCashiers) {
    let cashierQuery = supabase
      .from('cashier')
      .select('id, name, employment_start_date, is_active', { count: 'exact' })
      .eq('outlet_id', outlet.id)
      .eq('is_active', true)
      .order('name')
      .range(from, to);
    if (search) cashierQuery = cashierQuery.ilike('name', `%${escapeIlike(search)}%`);
    const result = await cashierQuery;
    cashiers = result.data ?? [];
    cashierCount = result.count ?? 0;
  }

  return (
    <div className="p-4">
      <Link
        href={`/branches/${outlet.branch_id}`}
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{branch?.name ?? 'Cabang'}</span>
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">{outlet.name}</h1>
          <p className="text-sm text-surface-500">{branch?.name}</p>
        </div>
        {outlet.is_active ? <Badge variant="success">Aktif</Badge> : <Badge variant="muted">Nonaktif</Badge>}
      </div>

      {canUpdateOutlet && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Edit Outlet</h2>
          <OutletEditForm outletId={outlet.id} currentName={outlet.name} />
        </div>
      )}

      {canViewCashiers && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Kasir</h2>
          <form method="get" className="mb-3 flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-medium text-surface-500">
              Cari kasir
              <input
                name="q"
                defaultValue={search}
                maxLength={100}
                placeholder="Nama kasir"
                className="input mt-1"
              />
            </label>
            <button type="submit" className="btn btn-secondary h-10 w-10 px-0" aria-label="Cari kasir" title="Cari">
              <Search className="mx-auto h-4 w-4" />
            </button>
          </form>
          <div className="space-y-2">
            {cashiers.map((cashier) => (
              <Link key={cashier.id} href={`/cashiers/${cashier.id}`} className="block">
                <Card className="flex items-center justify-between transition-colors hover:bg-surface-100">
                  <div>
                    <p className="font-medium text-surface-900">{cashier.name}</p>
                    <p className="text-xs text-surface-500">
                      Masa kerja {formatEmploymentDuration(cashier.employment_start_date)}
                    </p>
                  </div>
                  <span className="text-surface-400" aria-hidden="true">&rarr;</span>
                </Card>
              </Link>
            ))}
            {cashiers.length === 0 && (
              <p className="text-sm text-surface-500">Belum ada kasir aktif.</p>
            )}
          </div>
          <PaginationControls
            pathname={`/outlets/${outlet.id}`}
            params={{ q: search || undefined }}
            page={page}
            totalPages={getTotalPages(cashierCount, pageSize)}
          />
        </div>
      )}

      {canCreateCashiers && (
        <div className="mt-6">
          <h2 className="mb-3 text-lg font-semibold text-surface-900">Tambah Kasir</h2>
          <CashierForm outletId={outlet.id} />
        </div>
      )}
    </div>
  );
}
