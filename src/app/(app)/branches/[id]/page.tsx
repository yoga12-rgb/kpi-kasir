import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { BackLink } from '@/components/navigation/BackLink';
import { OutletForm } from '@/components/outlets/OutletForm';
import { BranchEditForm } from '@/components/branches/BranchEditForm';
import {
  BranchOutletListClient,
  type BranchOutletListItem,
} from '@/components/branches/BranchOutletListClient';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { getTotalPages, parsePage } from '@/lib/pagination';
import { createClient } from '@/lib/supabase/server';
import { getSafeReturnTo } from '@/lib/navigation';
import { queryOutlets } from '@/lib/server/list-queries';

export default async function BranchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ q?: string; page?: string; returnTo?: string }>;
}) {
  const profile = await requirePermission('branches.view');
  const permissions = await getRolePermissions(profile.role);
  const canCreateOutlet = profile.role === 'admin' || hasPermission(permissions, 'outlets.create');
  const { id } = await params;
  const listParams = await searchParams;
  const backHref = getSafeReturnTo(listParams?.returnTo, '/branches');
  const search = listParams?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(listParams?.page);
  const pageSize = 25;
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

  const outletQuery = await queryOutlets(supabase, {
    actor: profile,
    branchId: branch.id,
    page,
    pageSize,
    search,
  });
  const { data: outlets, count: outletCount } = await outletQuery;
  const initialItems: BranchOutletListItem[] = (outlets ?? []).map((outlet) => ({
    id: outlet.id,
    name: outlet.name,
    isActive: outlet.is_active,
    cashierCount: outlet.cashier?.[0]?.count ?? 0,
  }));
  const total = outletCount ?? 0;

  return (
    <div className="p-4">
      <BackLink href={backHref} label="Cabang" />

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">{branch.name}</h1>
          <p className="text-sm text-surface-500">
            {branch.code ?? 'Tanpa kode'} &middot; {outletCount ?? 0} outlet
          </p>
        </div>
        {branch.is_active ? (
          <Badge variant="success">Aktif</Badge>
        ) : (
          <Badge variant="muted">Nonaktif</Badge>
        )}
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-surface-900">Outlet</h2>
        <BranchOutletListClient
          branchId={branch.id}
          initialResult={{
            items: initialItems,
            page,
            pageSize,
            total,
            totalPages: getTotalPages(total, pageSize),
          }}
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
