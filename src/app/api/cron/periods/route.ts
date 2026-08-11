import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/route';
import { getCronContext } from '@/lib/cron/auth';
import { revalidatePeriodOptions } from '@/lib/cache/reference';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Cron endpoint POST-only. Buka periode bulan berjalan setelah rollover lama berhasil.
 */
async function handlePOST(request: Request) {
  const { authorized, invocationId } = getCronContext(request);
  if (!authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', invocationId },
      { status: 401, headers: { 'x-invocation-id': invocationId } }
    );
  }

  console.info(`[cron:${invocationId}] periods started`);
  try {
    const supabase = await createAdminClient();
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate = `${year}-${month}-${lastDay}`;
    const currentLabel = `${year}-${month}`;

    const { data: openPeriod, error: openLookupError } = await supabase
      .from('period')
      .select('id, label')
      .eq('status', 'open')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openLookupError) throw openLookupError;

    if (openPeriod && openPeriod.label !== currentLabel) {
      const { error: closeError } = await supabase.rpc('close_period', {
        p_period_id: openPeriod.id,
      });
      if (closeError) {
        console.warn(`[cron:${invocationId}] periods rollover blocked`, closeError);
        return NextResponse.json(
          { error: closeError.message, invocationId },
          { status: 409, headers: { 'x-invocation-id': invocationId } }
        );
      }
      revalidatePeriodOptions();
    }

    const { data, error } = await supabase.rpc('open_period', {
      p_start_date: startDate,
      p_end_date: endDate,
    });
    if (error) throw error;
    revalidatePeriodOptions();

    console.info(`[cron:${invocationId}] periods completed`);
    return NextResponse.json(
      { success: true, period: data, invocationId },
      { headers: { 'x-invocation-id': invocationId } }
    );
  } catch (error) {
    console.error(`[cron:${invocationId}] periods failed`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menjalankan cron', invocationId },
      { status: 500, headers: { 'x-invocation-id': invocationId } }
    );
  }
}

export const POST = withApiRoute(handlePOST, { publicRoute: true });
