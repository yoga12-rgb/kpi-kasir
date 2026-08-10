import { ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { NavigationLink } from '@/components/ui/NavigationLink';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';
import { escapeIlike, getPageRange, getTotalPages, parsePage } from '@/lib/pagination';
import { formatDate, formatEmploymentDuration } from '@/lib/utils';

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
  const status =
    isAdmin && ['active', 'inactive', 'all'].includes(requestedStatus ?? '')
      ? requestedStatus
      : 'active';
  const search = params?.q?.trim().slice(0, 100) ?? '';
  const page = parsePage(params?.page);
  const pageSize = 25;
  const { from, to } = getPageRange(page, pageSize);

  let query = supabase
    .from('cashier')
    .select(
      'id, name, avatar_url, is_active, employment_start_date, outlet_id, outlet!inner(name, branch(name))',
      { count: 'exact' }
    )
    .order('name')
    .range(from, to);

  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);
  if (search) query = query.ilike('name', `%${escapeIlike(search)}%`);

  if (!isAdmin) {
    const { data: ub } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    query = query.in(
      'outlet.branch_id',
      (ub ?? []).map((item) => item.branch_id)
    );
  }

  const { data: cashiers, count } = await query;
  const totalPages = getTotalPages(count, pageSize);
  const avatarMap = await getCashierAvatarUrls(
    supabase,
    (cashiers ?? []).map((cashier) => cashier.avatar_url)
  );

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
        {isAdmin && (
          <form method="get">
            <label htmlFor="cashier-status" className="sr-only">
              Filter status kasir
            </label>
            <select
              id="cashier-status"
              name="status"
              defaultValue={status}
              className="input w-auto text-xs"
            >
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
              <option value="all">Semua</option>
            </select>
          </form>
        )}
      </div>

      <form method="get" className="mt-4 flex items-end gap-2">
        {isAdmin && <input type="hidden" name="status" value={status} />}
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

      <div className="mt-4 space-y-2">
        {(cashiers ?? []).map((cashier) => {
          const outlet = cashier.outlet as unknown as { name: string; branch: { name: string } };
          return (
            <NavigationLink
              key={cashier.id}
              href={`/cashiers/${cashier.id}`}
              pendingIndicator
              className="block"
            >
              <Card className="flex items-center gap-3 transition-colors hover:bg-surface-100">
                <CashierAvatar
                  name={cashier.name}
                  src={cashier.avatar_url ? (avatarMap.get(cashier.avatar_url) ?? null) : null}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-surface-900">{cashier.name}</p>
                    {!cashier.is_active && <Badge variant="muted">Nonaktif</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-surface-400">
                    Mulai {formatDate(cashier.employment_start_date)} &middot;{' '}
                    {formatEmploymentDuration(cashier.employment_start_date)}
                  </p>
                  <p className="truncate text-sm text-surface-500">
                    {outlet?.branch?.name} &middot; {outlet?.name}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-surface-400" />
              </Card>
            </NavigationLink>
          );
        })}
        {(cashiers ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-surface-500">Belum ada kasir.</p>
        )}
      </div>

      <PaginationControls
        pathname="/cashiers"
        params={{ status: isAdmin ? status : undefined, q: search || undefined }}
        page={page}
        totalPages={totalPages}
      />
    </div>
  );
}
