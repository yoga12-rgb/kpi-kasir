import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

/**
 * Request-scoped deduplication for the shell badge and dashboard metric.
 * This intentionally is not a cross-request cache because unread state is user-specific.
 */
export const getUnreadNotificationCount = cache(async (userId: string): Promise<number | null> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('notification')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  return error ? null : count ?? 0;
});
