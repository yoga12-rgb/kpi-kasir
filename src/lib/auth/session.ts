import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/types/database';

export interface SessionUser {
  id: string;
  email: string | null | undefined;
  profile: UserProfile | null;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

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
