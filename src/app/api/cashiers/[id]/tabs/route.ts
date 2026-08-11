import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/auth/permissions';
import { getRolePermissions } from '@/lib/auth/permissions-server';
import { withApiRoute } from '@/lib/api/route';
import { createClient } from '@/lib/supabase/server';

const cashierIdSchema = z.string().uuid();
const tabSchema = z.enum(['mutation', 'placement', 'mentoring']);

function privateJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(body, { ...init, headers });
}

function outletFromRelation(value: unknown): { branch_id: string } | null {
  const outlet = Array.isArray(value) ? value[0] : value;
  if (!outlet || typeof outlet !== 'object' || !('branch_id' in outlet)) return null;
  return outlet as { branch_id: string };
}

async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profile = await requirePermission('cashiers.view');
  const { id } = await params;
  const cashierId = cashierIdSchema.safeParse(id);
  const tab = tabSchema.safeParse(new URL(request.url).searchParams.get('tab'));

  if (!cashierId.success || !tab.success) {
    return privateJson({ error: 'Parameter tab kasir tidak valid' }, { status: 400 });
  }

  const supabase = await createClient();
  const [cashierResult, branchAccessResult] = await Promise.all([
    supabase
      .from('cashier')
      .select('id, outlet_id, is_active, outlet!inner(branch_id)')
      .eq('id', cashierId.data)
      .maybeSingle(),
    profile.role === 'admin'
      ? Promise.resolve({ data: [] as { branch_id: string }[], error: null })
      : supabase.from('user_branch').select('branch_id').eq('user_id', profile.id),
  ]);

  if (cashierResult.error) throw cashierResult.error;
  const cashier = cashierResult.data;
  const outlet = outletFromRelation(cashier?.outlet);
  if (!cashier || !outlet) {
    return privateJson({ error: 'Kasir tidak ditemukan' }, { status: 404 });
  }

  if (profile.role !== 'admin') {
    if (branchAccessResult.error) throw branchAccessResult.error;
    const allowedBranchIds = (branchAccessResult.data ?? []).map((assignment) => assignment.branch_id);
    if (!allowedBranchIds.includes(outlet.branch_id)) {
      return privateJson({ error: 'Akses cabang ditolak' }, { status: 403 });
    }
  }

  if (tab.data === 'mutation') {
    if (profile.role !== 'admin') {
      return privateJson({ error: 'Akses mutasi outlet ditolak' }, { status: 403 });
    }
    if (!cashier.is_active) {
      return privateJson({ error: 'Kasir nonaktif tidak dapat dimutasi' }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('outlet')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return privateJson({ tab: 'mutation', outlets: data ?? [] });
  }

  if (tab.data === 'mentoring') {
    if (profile.role !== 'admin') {
      const permissions = await getRolePermissions(profile.role);
      if (!hasPermission(permissions, 'mentoring')) {
        return privateJson({ error: 'Akses pendampingan ditolak' }, { status: 403 });
      }
    }

    const { data, error } = await supabase
      .from('mentoring_cashier_note')
      .select('id, note, mentoring_session!inner(outlet(name), visited_date, conducted_by(full_name))')
      .eq('cashier_id', cashier.id)
      .order('mentoring_session(visited_date)', { ascending: false });
    if (error) throw error;
    return privateJson({ tab: 'mentoring', notes: data ?? [] });
  }

  const [historiesResult, statusHistoriesResult] = await Promise.all([
    supabase
      .from('cashier_outlet_history')
      .select('id, started_at, ended_at, outlet(name)')
      .eq('cashier_id', cashier.id)
      .order('started_at', { ascending: false }),
    profile.role === 'admin'
      ? supabase
          .from('cashier_status_history')
          .select('id, is_active, effective_at, reason, changed_by(full_name)')
          .eq('cashier_id', cashier.id)
          .order('effective_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (historiesResult.error) throw historiesResult.error;
  if (statusHistoriesResult.error) throw statusHistoriesResult.error;

  return privateJson({
    tab: 'placement',
    histories: historiesResult.data ?? [],
    statusHistories: statusHistoriesResult.data ?? [],
  });
}

export const GET = withApiRoute(handleGET);
