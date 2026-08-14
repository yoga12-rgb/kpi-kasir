import { NextResponse } from 'next/server';
import { assessmentListQuerySchema } from '@/lib/assessment/list';
import { requirePermission } from '@/lib/auth/guards';
import {
  AssessmentListError,
  getAssessmentAccessibleBranchIds,
  getAssessmentList,
  getOpenAssessmentPeriod,
} from '@/lib/server/assessment-list';
import { withApiRoute } from '@/lib/api/route';
import { createClient } from '@/lib/supabase/server';

async function handleGET(request: Request) {
  const profile = await requirePermission('assessment');
  const parsed = assessmentListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Parameter filter penilaian tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const [period, branchIds] = await Promise.all([
      getOpenAssessmentPeriod(supabase),
      getAssessmentAccessibleBranchIds(supabase, profile),
    ]);
    if (!period) {
      return NextResponse.json({
        cashiers: [],
        page: parsed.data.page,
        pageSize: parsed.data.limit,
        total: 0,
        totalPages: 1,
        hasMore: false,
      });
    }

    return NextResponse.json(
      await getAssessmentList(supabase, {
        periodId: period.id,
        branchIds,
        filters: parsed.data,
      })
    );
  } catch (error) {
    if (error instanceof AssessmentListError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Gagal memuat daftar penilaian' }, { status: 500 });
  }
}

export const GET = withApiRoute(handleGET);
