import { revalidateTag, unstable_cache } from 'next/cache';
import { logServerPerformance, nowMs } from '@/lib/performance/server';
import { createAdminClient } from '@/lib/supabase/server';
import type { PeriodStatus } from '@/types/database';

/**
 * These values are global, field-limited reference data. Do not add session-,
 * user-, or branch-scoped queries here because this cache persists across users.
 */
export const CACHE_TAGS = {
  periodOptions: 'reference:period-options:v1',
} as const;

export interface CachedPeriodOption {
  id: string;
  label: string;
  status: PeriodStatus;
  startDate: string;
  endDate: string;
}

const getPeriodOptionsFromCache = unstable_cache(
  async (): Promise<CachedPeriodOption[]> => {
    logServerPerformance('cache-miss', { cache: 'period-options' });
    const supabase = await createAdminClient();
    const { data, error } = await supabase
      .from('period')
      .select('id, label, status, start_date, end_date')
      .order('start_date', { ascending: false })
      .limit(24);

    if (error) throw error;

    return (data ?? []).map((period) => ({
      id: period.id,
      label: period.label,
      status: period.status,
      startDate: period.start_date,
      endDate: period.end_date,
    }));
  },
  ['reference-period-options-v1'],
  { revalidate: 60, tags: [CACHE_TAGS.periodOptions] }
);

export async function getCachedPeriodOptions() {
  const startedAt = nowMs();
  const periods = await getPeriodOptionsFromCache();
  logServerPerformance('cache-access', {
    cache: 'period-options',
    durationMs: Number((nowMs() - startedAt).toFixed(1)),
    resultCount: periods.length,
  });
  return periods;
}

export function revalidatePeriodOptions() {
  revalidateTag(CACHE_TAGS.periodOptions, 'max');
}
