import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { OutletForm } from '@/components/outlets/OutletForm';
import { BranchEditForm } from '@/components/branches/BranchEditForm';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { createClient } from '@/lib/supabase/server';

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('branches.view');
  const permissions = await getRolePermissions(profile.role);
  const canCreateOutlet = profile.role === 'admin' || hasPermission(permissions, 'outlets.create');
  const { id } = await params;
  const supabase = await createClient();

  const { data: branch } = await supabase
    .from('branch')
    .select('*, outlet(*, cashier(count))')
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

  const outletCount = (branch.outlet ?? []).length;

  return (
    <div className="p-4">
        <Link href="/branches" className="text-sm text-primary-600 hover:underline">
          ← Kembali
        </Link>

        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-surface-900">{branch.name}</h1>
            <p className="text-sm text-surface-500">
              {branch.code ?? 'Tanpa kode'} · {outletCount} outlet
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
          <div className="space-y-3">
            {(branch.outlet ?? []).map(
              (outlet: {
                id: string;
                name: string;
                is_active: boolean;
                cashier?: { count: number }[];
              }) => (
                <Link key={outlet.id} href={`/outlets/${outlet.id}`} className="block">
                  <Card className="transition-colors hover:bg-surface-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-surface-900">{outlet.name}</p>
                        <p className="text-sm text-surface-500">
                          {outlet.cashier?.[0]?.count ?? 0} kasir
                        </p>
                      </div>
                      {outlet.is_active ? (
                        <Badge variant="success">Aktif</Badge>
                      ) : (
                        <Badge variant="muted">Nonaktif</Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              )
            )}
            {(branch.outlet ?? []).length === 0 && (
              <p className="text-sm text-surface-500">Belum ada outlet.</p>
            )}
          </div>
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
