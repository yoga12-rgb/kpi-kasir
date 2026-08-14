import { redirect } from 'next/navigation';
import { AssessmentList } from '@/components/assessment/AssessmentList';
import { assessmentListQuerySchema, type AssessmentListQuery } from '@/lib/assessment/list';
import { requirePermission } from '@/lib/auth/guards';
import { buildPath } from '@/lib/navigation';
import {
  getAssessmentAccessibleBranchIds,
  getAssessmentList,
  getAssessmentListOptions,
  getOpenAssessmentPeriod,
} from '@/lib/server/assessment-list';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function buildAssessmentPath(filters: AssessmentListQuery) {
  return buildPath('/assessment', {
    branchId: filters.branchId,
    outletId: filters.outletId,
    status: filters.status === 'pending' ? undefined : filters.status,
    q: filters.q,
    page: filters.page > 1 ? String(filters.page) : undefined,
  });
}

export default async function AssessmentPage({
  searchParams,
}: {
  searchParams?: Promise<{
    branchId?: string;
    outletId?: string;
    status?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const profile = await requirePermission('assessment');
  const params = await searchParams;
  const parsedFilters = assessmentListQuerySchema.safeParse({
    branchId: params?.branchId,
    outletId: params?.outletId,
    status: params?.status,
    q: params?.q,
    page: params?.page,
  });
  if (!parsedFilters.success) redirect('/assessment');

  const supabase = await createClient();
  const [period, branchIds] = await Promise.all([
    getOpenAssessmentPeriod(supabase),
    getAssessmentAccessibleBranchIds(supabase, profile),
  ]);

  if (!period) {
    return (
      <div className="p-4">
        <h1 className="text-xl font-bold text-surface-900">Penilaian</h1>
        <p className="mt-0.5 text-sm text-surface-500">Tidak ada periode aktif</p>
      </div>
    );
  }

  const options = await getAssessmentListOptions(supabase, branchIds);
  const requestedFilters = parsedFilters.data;
  const selectedOutlet = options.outlets.find((outlet) => outlet.id === requestedFilters.outletId);
  const branchId = options.branches.some((branch) => branch.id === requestedFilters.branchId)
    ? requestedFilters.branchId
    : undefined;
  const outletId =
    selectedOutlet && (!branchId || selectedOutlet.branch_id === branchId)
      ? selectedOutlet.id
      : undefined;
  const filters: AssessmentListQuery = {
    ...requestedFilters,
    branchId,
    outletId,
  };

  if (buildAssessmentPath(filters) !== buildAssessmentPath(requestedFilters)) {
    redirect(buildAssessmentPath(filters));
  }

  const initialResponse = await getAssessmentList(supabase, {
    periodId: period.id,
    branchIds,
    filters,
  });
  if (filters.page > initialResponse.totalPages) {
    redirect(
      buildAssessmentPath({
        ...filters,
        page: initialResponse.totalPages,
      })
    );
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-surface-900">Penilaian</h1>
      <p className="mt-0.5 text-sm text-surface-500">Periode berjalan &middot; {period.label}</p>

      <AssessmentList
        initialResult={{
          items: initialResponse.cashiers,
          page: initialResponse.page,
          pageSize: initialResponse.pageSize,
          total: initialResponse.total,
          totalPages: initialResponse.totalPages,
        }}
        branches={options.branches}
        outlets={options.outlets}
      />
    </div>
  );
}
