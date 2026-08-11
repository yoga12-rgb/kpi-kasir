import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { logServerPerformance, nowMs } from '@/lib/performance/server';
import type { UserProfile } from '@/types/database';

export interface SessionUser {
  id: string;
  email: string | null | undefined;
  profile: UserProfile | null;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const startedAt = nowMs();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logServerPerformance('auth-session', {
      durationMs: Number((nowMs() - startedAt).toFixed(1)),
      authenticated: false,
    });
    return null;
  }

  const { data: profile } = await supabase
    .from('users')
    .select('id, email, full_name, role, is_active, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  logServerPerformance('auth-session', {
    durationMs: Number((nowMs() - startedAt).toFixed(1)),
    authenticated: true,
    profileFound: Boolean(profile),
  });

  return {
    id: user.id,
    email: user.email,
    profile,
  };
});

export const getUserBranches = cache(async (userId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from('user_branch').select('branch_id').eq('user_id', userId);
  return (data ?? []).map((ub) => ub.branch_id);
});
