import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CashierForm } from '@/components/cashiers/CashierForm';
import { OutletEditForm } from '@/components/outlets/OutletEditForm';
import { requireAnyPermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { createClient } from '@/lib/supabase/server';
import { formatEmploymentDuration } from '@/lib/utils';

export default async function OutletDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  const supabase = await createClient();

  const { data: outlet } = await supabase
    .from('outlet')
    .select('*, branch(name), cashier(*)')
    .eq('id', id)
    .single();

  if (!outlet) notFound();

  // Cek akses untuk non-admin
  if (profile.role !== 'admin') {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    const allowed = (ub ?? []).map((x) => x.branch_id);
    if (!allowed.includes(outlet.branch_id)) {
      redirect('/dashboard');
    }
  }

  const cashiers = canViewCashiers
    ? ((outlet.cashier ?? []) as {
        id: string;
        name: string;
        employment_start_date: string;
        is_active: boolean;
      }[])
    : [];

  return (
    <div className="p-4">
      <Link
        href={`/branches/${outlet.branch_id}`}
        className="inline-flex items-center gap-1 text-sm text-primary-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{outlet.branch?.name ?? 'Cabang'}</span>
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-surface-900">{outlet.name}</h1>
          <p className="text-sm text-surface-500">{outlet.branch?.name}</p>
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
          <div className="space-y-2">
            {cashiers
              .filter((c) => c.is_active)
              .map(
                (cashier: {
                  id: string;
                  name: string;
                  employment_start_date: string;
                  is_active: boolean;
                }) => (
                  <Link key={cashier.id} href={`/cashiers/${cashier.id}`} className="block">
                    <Card className="flex items-center justify-between transition-colors hover:bg-surface-100">
                      <div>
                        <p className="font-medium text-surface-900">{cashier.name}</p>
                        <p className="text-xs text-surface-500">
                          Masa kerja {formatEmploymentDuration(cashier.employment_start_date)}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-surface-400" />
                    </Card>
                  </Link>
                )
              )}
            {cashiers.filter((c) => c.is_active).length === 0 && (
              <p className="text-sm text-surface-500">Belum ada kasir aktif.</p>
            )}
          </div>
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
