import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { BackLink } from '@/components/navigation/BackLink';
import { CashierForm } from '@/components/cashiers/CashierForm';
import {
  OutletCashierListClient,
  type OutletCashierListItem,
} from '@/components/outlets/OutletCashierListClient';
import { OutletEditForm } from '@/components/outlets/OutletEditForm';
import { requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { getTotalPages, parsePage } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { getSafeReturnTo } from '@/lib/navigation';
import { queryCashiers } from '@/lib/server/list-queries';

export default async function OutletDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string; page?: string; returnTo?: string }>;
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
  const backHref = getSafeReturnTo(listParams?.returnTo, `/branches/${id}`);
  const search = listParams?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(listParams?.page);
  const pageSize = 25;
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
    const cashierQuery = await queryCashiers(supabase, {
      actor: profile,
      status: 'active',
      outletId: outlet.id,
      page,
      pageSize,
      search,
    });
    const result = await cashierQuery;
    cashiers = result.data ?? [];
    cashierCount = result.count ?? 0;
  }
  const initialItems: OutletCashierListItem[] = cashiers.map((cashier) => ({
    id: cashier.id,
    name: cashier.name,
    employmentStartDate: cashier.employment_start_date,
    isActive: cashier.is_active,
  }));

  return (
    <div className="p-4">
      <BackLink href={backHref} label={branch?.name ?? 'Cabang'} />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">{outlet.name}</h1>
          <p className="text-sm text-surface-500">{branch?.name}</p>
        </div>
        {outlet.is_active ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="muted">Nonaktif</Badge>
        )}
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
          <OutletCashierListClient
            outletId={outlet.id}
            initialResult={{
              items: initialItems,
              page,
              pageSize,
              total: cashierCount,
              totalPages: getTotalPages(cashierCount, pageSize),
            }}
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
