import { NextResponse } from 'next/server';
import { withApiRoute } from '@/lib/api/route';
import { getCronContext } from '@/lib/cron/auth';
import { createAdminClient } from '@/lib/supabase/server';
import type { TablesInsert } from '@/types/database';

interface Recipient {
  user_id: string;
  branch_id: string;
}

function getRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

async function handlePOST(request: Request) {
  const { authorized, invocationId } = getCronContext(request);
  if (!authorized) {
    return NextResponse.json(
      { error: 'Unauthorized', invocationId },
      { status: 401, headers: { 'x-invocation-id': invocationId } }
    );
  }

  console.info(`[cron:${invocationId}] notifications started`);
  try {
    const supabase = await createAdminClient();
    const { data: period, error: periodError } = await supabase
      .from('period')
      .select('id, label')
      .eq('status', 'open')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (periodError) throw periodError;

    if (!period) {
      return NextResponse.json(
        { success: true, count: 0, message: 'Tidak ada periode aktif', invocationId },
        { headers: { 'x-invocation-id': invocationId } }
      );
    }

    const [{ data: cashiers, error: cashierError }, { data: completions, error: completionError }, { data: userBranches, error: userBranchError }, { data: users, error: userError }, { data: permissionRows, error: permissionError }] = await Promise.all([
      supabase
        .from('cashier')
        .select('id, name, outlet!inner(branch_id, name)')
        .eq('is_active', true),
      supabase
        .from('cashier_period_completion')
        .select('cashier_id, status, assessed_details, total_details')
        .eq('period_id', period.id),
      supabase.from('user_branch').select('user_id, branch_id'),
      supabase.from('users').select('id, role, is_active').eq('is_active', true),
      supabase
        .from('role_permission')
        .select('role')
        .eq('permission', 'notifications')
        .eq('enabled', true),
    ]);
    if (cashierError || completionError || userBranchError || userError || permissionError) {
      throw cashierError ?? completionError ?? userBranchError ?? userError ?? permissionError;
    }

    const allowedRoles = new Set<string>(['admin', ...(permissionRows ?? []).map((row) => row.role)]);
    const eligibleUsers = new Set(
      (users ?? []).filter((user) => user.is_active && allowedRoles.has(user.role)).map((user) => user.id)
    );
    const adminIds = new Set(
      (users ?? [])
        .filter((user) => user.is_active && user.role === 'admin' && eligibleUsers.has(user.id))
        .map((user) => user.id)
    );
    const usersByBranch = new Map<string, string[]>();
    for (const row of userBranches ?? []) {
      if (!eligibleUsers.has(row.user_id)) continue;
      const list = usersByBranch.get(row.branch_id) ?? [];
      list.push(row.user_id);
      usersByBranch.set(row.branch_id, list);
    }

    function recipientsForBranch(branchId: string): Recipient[] {
      const ids = new Set([...(usersByBranch.get(branchId) ?? []), ...adminIds]);
      return Array.from(ids).map((userId) => ({ user_id: userId, branch_id: branchId }));
    }

    const completionMap = new Map((completions ?? []).map((completion) => [completion.cashier_id, completion]));
    const notificationRows: TablesInsert<'notification'>[] = [];

    for (const cashier of cashiers ?? []) {
      const outlet = getRelation(cashier.outlet as { branch_id: string; name: string } | { branch_id: string; name: string }[]);
      if (!outlet?.branch_id) continue;
      const completion = completionMap.get(cashier.id);
      if (completion?.status === 'complete') continue;

      for (const recipient of recipientsForBranch(outlet.branch_id)) {
        notificationRows.push({
          user_id: recipient.user_id,
          type: 'reminder_unassessed',
          title: `Reminder: ${cashier.name} belum selesai dinilai`,
          body: `${cashier.name} (${outlet.name}) baru menilai ${completion?.assessed_details ?? 0}/${completion?.total_details ?? 0} detail pada periode ${period.label}.`,
          payload: { cashier_id: cashier.id, period_id: period.id },
          entity_type: 'cashier',
          entity_id: cashier.id,
          period_id: period.id,
          dedupe_key: `reminder_unassessed:${recipient.user_id}:${cashier.id}:${period.id}`,
        });
      }
    }

    const { data: entryRows, error: entryError } = await supabase
      .from('leaderboard_entry')
      .select('cashier_id, total_score, period!inner(start_date)')
      .order('start_date', { ascending: false, referencedTable: 'period' })
      .limit(5000);
    if (entryError) throw entryError;

    const byCashier = new Map<string, number[]>();
    for (const entry of entryRows ?? []) {
      const scores = byCashier.get(entry.cashier_id) ?? [];
      scores.push(Number(entry.total_score));
      byCashier.set(entry.cashier_id, scores);
    }

    for (const [cashierId, scores] of byCashier) {
      const recent = scores.slice(0, 3);
      if (recent.length < 3 || !recent.every((score) => score < 70)) continue;
      const cashier = (cashiers ?? []).find((item) => item.id === cashierId);
      const outlet = cashier
        ? getRelation(cashier.outlet as { branch_id: string; name: string } | { branch_id: string; name: string }[])
        : null;
      if (!cashier || !outlet?.branch_id) continue;

      for (const recipient of recipientsForBranch(outlet.branch_id)) {
        notificationRows.push({
          user_id: recipient.user_id,
          type: 'low_score_alert',
          title: `Alert: skor ${cashier.name} rendah`,
          body: `Skor ${cashier.name} di bawah 70 selama 3 periode berturut-turut.`,
          payload: { cashier_id: cashierId, period_id: period.id },
          entity_type: 'cashier',
          entity_id: cashierId,
          period_id: period.id,
          dedupe_key: `low_score_alert:${recipient.user_id}:${cashierId}:${period.id}`,
        });
      }
    }

    const { data: inserted, error: insertError } = notificationRows.length
      ? await supabase
          .from('notification')
          .upsert(notificationRows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
          .select('id')
      : { data: [], error: null };
    if (insertError) throw insertError;

    const count = inserted?.length ?? 0;
    console.info(`[cron:${invocationId}] notifications completed count=${count}`);
    return NextResponse.json(
      { success: true, count, invocationId },
      { headers: { 'x-invocation-id': invocationId } }
    );
  } catch (error) {
    console.error(`[cron:${invocationId}] notifications failed`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Gagal menjalankan cron', invocationId },
      { status: 500, headers: { 'x-invocation-id': invocationId } }
    );
  }
}

export const POST = withApiRoute(handlePOST, { publicRoute: true });
