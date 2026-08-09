import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Cron: reminder kasir belum dinilai + alert skor rendah berturut-turut.
 * Dilindungi CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = request.headers.get('x-cron-secret') ?? new URL(request.url).searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createAdminClient();
  let count = 0;

  try {
    // Periode aktif
    const { data: period } = await supabase
      .from('period')
      .select('id, label')
      .eq('status', 'open')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!period) {
      return NextResponse.json({ success: true, count: 0, message: 'Tidak ada periode aktif' });
    }

    // Kasir aktif + cabang
    const { data: cashiers } = await supabase
      .from('cashier')
      .select('id, name, outlet(branch_id, name)')
      .eq('is_active', true);

    // Assessment di periode ini
    const { data: assessments } = await supabase
      .from('assessment')
      .select('cashier_id')
      .eq('period_id', period.id);

    const assessedCashierIds = new Set((assessments ?? []).map((a) => a.cashier_id));

    // User per cabang (manager/supervisor)
    const { data: userBranches } = await supabase
      .from('user_branch')
      .select('user_id, branch_id');

    const usersByBranch = new Map<string, string[]>();
    for (const ub of userBranches ?? []) {
      const list = usersByBranch.get(ub.branch_id) ?? [];
      list.push(ub.user_id);
      usersByBranch.set(ub.branch_id, list);
    }

    // Buat reminder untuk kasir yang belum dinilai sama sekali
    for (const c of cashiers ?? []) {
      const outlet = c.outlet as unknown as { branch_id: string; name: string };
      if (!outlet?.branch_id) continue;
      if (assessedCashierIds.has(c.id)) continue;

      const userIds = usersByBranch.get(outlet.branch_id) ?? [];
      if (userIds.length === 0) continue;

      const { error } = await supabase.from('notification').insert(
        userIds.map((userId) => ({
          user_id: userId,
          type: 'reminder_unassessed',
          title: `Reminder: ${c.name} belum dinilai`,
          body: `${c.name} (${outlet.name}) belum dinilai pada periode ${period.label}.`,
          payload: { cashier_id: c.id, period_id: period.id },
        }))
      );

      if (!error) count += userIds.length;
    }

    // Alert skor rendah berturut-turut (>= 3 periode < 70)
    const { data: entryRows } = await supabase
      .from('leaderboard_entry')
      .select('cashier_id, total_score, period_id')
      .order('period_id', { ascending: false })
      .limit(1000);

    const byCashier = new Map<string, number[]>();
    for (const e of entryRows ?? []) {
      const list = byCashier.get(e.cashier_id) ?? [];
      list.push(Number(e.total_score));
      byCashier.set(e.cashier_id, list);
    }

    for (const [cashierId, scores] of byCashier) {
      const recent = scores.slice(0, 3);
      if (recent.length < 3) continue;
      if (recent.every((s) => s < 70)) {
        const cashier = (cashiers ?? []).find((c) => c.id === cashierId);
        if (!cashier) continue;
        const outlet = cashier.outlet as unknown as { branch_id: string; name: string };
        const userIds = outlet?.branch_id
          ? (usersByBranch.get(outlet.branch_id) ?? [])
          : [];

        for (const userId of userIds) {
          const { error } = await supabase.from('notification').insert({
            user_id: userId,
            type: 'low_score_alert',
            title: `Alert: skor ${cashier.name} rendah`,
            body: `Skor ${cashier.name} di bawah 70 selama 3 periode berturut-turut.`,
            payload: { cashier_id: cashierId },
          });
          if (!error) count++;
        }
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Gagal menjalankan cron' },
      { status: 500 }
    );
  }
}