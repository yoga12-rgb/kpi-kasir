import type { UserRole } from '@/types/database';
import { createClient } from '@/lib/supabase/server';
import { escapeIlike, getPageRange } from '@/lib/pagination';

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ListActor = {
  id: string;
  role: UserRole;
};

interface ListOptions {
  page: number;
  pageSize: number;
  search?: string;
}

export type CashierStatus = 'active' | 'inactive' | 'all';

export async function queryCashiers(
  supabase: ServerClient,
  {
    actor,
    status = 'active',
    outletId,
    branchId,
    page,
    pageSize,
    search,
  }: ListOptions & {
    actor: ListActor;
    status?: CashierStatus;
    outletId?: string;
    branchId?: string;
  }
) {
  const { from, to } = getPageRange(page, pageSize);
  let query = supabase
    .from('cashier')
    .select(
      'id, name, avatar_url, is_active, employment_start_date, outlet_id, outlet!inner(name, branch_id, branch:branch(name))',
      { count: 'exact' }
    )
    .order('name')
    .range(from, to);

  if (status === 'active') query = query.eq('is_active', true);
  if (status === 'inactive') query = query.eq('is_active', false);
  if (outletId) query = query.eq('outlet_id', outletId);
  if (branchId) query = query.eq('outlet.branch_id', branchId);
  if (search) query = query.ilike('name', `%${escapeIlike(search)}%`);

  if (actor.role !== 'admin') {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', actor.id);
    query = query.in(
      'outlet.branch_id',
      (userBranches ?? []).map((userBranch) => userBranch.branch_id)
    );
  }

  return query;
}

export async function queryBranches(
  supabase: ServerClient,
  { actor, page, pageSize, search }: ListOptions & { actor: ListActor }
) {
  const { from, to } = getPageRange(page, pageSize);
  let query = supabase
    .from('branch')
    .select('id, name, code, is_active, outlet(count)', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (search) {
    const escaped = escapeIlike(search);
    query = query.or(`name.ilike.%${escaped}%,code.ilike.%${escaped}%`);
  }
  if (actor.role !== 'admin') {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', actor.id);
    query = query.in(
      'id',
      (userBranches ?? []).map((userBranch) => userBranch.branch_id)
    );
  }

  return query;
}

export async function queryOutlets(
  supabase: ServerClient,
  { actor, branchId, page, pageSize, search }: ListOptions & { actor: ListActor; branchId?: string }
) {
  const { from, to } = getPageRange(page, pageSize);
  let query = supabase
    .from('outlet')
    .select('id, branch_id, name, is_active, branch(name), cashier(count)', { count: 'exact' })
    .order('name')
    .range(from, to);

  if (branchId) query = query.eq('branch_id', branchId);
  if (search) query = query.ilike('name', `%${escapeIlike(search)}%`);
  if (actor.role !== 'admin') {
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', actor.id);
    query = query.in(
      'branch_id',
      (userBranches ?? []).map((userBranch) => userBranch.branch_id)
    );
  }

  return query;
}

export async function queryUsers(supabase: ServerClient, { page, pageSize, search }: ListOptions) {
  const { from, to } = getPageRange(page, pageSize);
  let query = supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    const escaped = escapeIlike(search);
    query = query.or(`full_name.ilike.%${escaped}%,email.ilike.%${escaped}%`);
  }

  return query;
}
