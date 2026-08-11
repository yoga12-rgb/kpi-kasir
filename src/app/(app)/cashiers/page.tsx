import { CashierListClient, type CashierListItem } from '@/components/cashiers/CashierListClient';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { getTotalPages, parsePage } from '@/lib/pagination';
import { queryCashiers } from '@/lib/server/list-queries';

export default async function CashiersPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const profile = await requirePermission('cashiers.view');
  const supabase = await createClient();
  const isAdmin = profile.role === 'admin';
  const params = await searchParams;
  const requestedStatus = params?.status;
  const status: 'active' | 'inactive' | 'all' =
    isAdmin && ['active', 'inactive', 'all'].includes(requestedStatus ?? '')
      ? (requestedStatus as 'active' | 'inactive' | 'all')
      : 'active';
  const search = params?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(params?.page);
  const pageSize = 25;
  const query = await queryCashiers(supabase, {
    actor: profile,
    status,
    page,
    pageSize,
    search,
  });

  const { data: cashiers, count } = await query;
  const totalPages = getTotalPages(count, pageSize);
  const avatarMap = await getCashierAvatarUrls(
    supabase,
    (cashiers ?? []).map((cashier) => cashier.avatar_url)
  );
  const initialItems: CashierListItem[] = (cashiers ?? []).map((cashier) => {
    const outlet = Array.isArray(cashier.outlet) ? cashier.outlet[0] : cashier.outlet;
    const branch = outlet?.branch;
    return {
      id: cashier.id,
      name: cashier.name,
      avatarSrc: cashier.avatar_url ? (avatarMap.get(cashier.avatar_url) ?? null) : null,
      isActive: cashier.is_active,
      employmentStartDate: cashier.employment_start_date,
      outletName: outlet?.name ?? '-',
      branchName: branch?.name ?? '-',
    };
  });
  const total = count ?? 0;

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-surface-900">Kasir</h1>
          <p className="mt-0.5 text-sm text-surface-500">
            {isAdmin
              ? status === 'inactive'
                ? 'Kasir nonaktif'
                : status === 'all'
                  ? 'Semua status kasir'
                  : 'Kasir aktif'
              : 'Kasir pada cabang yang ditugaskan'}
          </p>
        </div>
      </div>

      <CashierListClient
        initialResult={{ items: initialItems, page, pageSize, total, totalPages }}
        isAdmin={isAdmin}
        initialStatus={status}
      />
    </div>
  );
}
