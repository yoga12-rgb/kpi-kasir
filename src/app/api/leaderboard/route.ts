import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getCashierAvatarUrls } from '@/lib/storage/cashier-avatar';

export const dynamic = 'force-dynamic';

interface LeaderboardRow {
  cashier_id: string;
  name: string;
  avatar_path: string | null;
  outlet_id: string;
  outlet_name: string;
  branch_id: string;
  branch_name: string;
  total_score: number;
  rank: number;
}

export async function GET(request: Request) {
  const profile = await requirePermission('leaderboard');
  const { searchParams } = new URL(request.url);
  const level = (searchParams.get('level') ?? 'global') as 'global' | 'branch' | 'outlet';
  const branchId = searchParams.get('branchId');
  const outletId = searchParams.get('outletId');
  const mode = (searchParams.get('mode') ?? 'period') as 'period' | 'cumulative';
  const periodId = searchParams.get('periodId');

  const supabase = await createClient();

  // Ambil cabang akses user
  let accessibleBranchIds: string[] = [];
  if (profile.role === 'admin') {
    const { data } = await supabase.from('branch').select('id').eq('is_active', true);
    accessibleBranchIds = (data ?? []).map((b) => b.id);
  } else {
    const { data } = await supabase
      .from('user_branch')
      .select('branch_id')
      .eq('user_id', profile.id);
    accessibleBranchIds = (data ?? []).map((x) => x.branch_id);
  }

  // Filter level
  if (level === 'branch' && branchId && !accessibleBranchIds.includes(branchId)) {
    return NextResponse.json({ error: 'Tidak punya akses' }, { status: 403 });
  }

  let rows: LeaderboardRow[] = [];

  if (mode === 'period') {
    // Periode berjalan: ambil skor dari cashier_period_score + info kasir/outlet/cabang
    let query = supabase
      .from('cashier_period_score')
      .select(
        'cashier_id, total_score, cashier!inner(id, name, avatar_url, outlet!inner(id, branch_id, name, branch(name)))'
      )
      .in('cashier.outlet.branch_id', accessibleBranchIds);

    if (periodId) query = query.eq('period_id', periodId);
    if (level === 'branch' && branchId) query = query.eq('cashier.outlet.branch_id', branchId);
    if (level === 'outlet' && outletId) query = query.eq('cashier.outlet_id', outletId);

    const { data } = await query.order('total_score', { ascending: false });

    rows = (data ?? []).map((s) => {
      const cashier = s.cashier as unknown as {
        id: string;
        name: string;
        avatar_url: string | null;
        outlet: { id: string; name: string; branch_id: string; branch: { name: string } };
      };
      return {
        cashier_id: s.cashier_id,
        name: cashier.name,
        avatar_path: cashier.avatar_url,
        outlet_id: cashier.outlet.id,
        outlet_name: cashier.outlet.name,
        branch_id: cashier.outlet.branch_id,
        branch_name: cashier.outlet.branch.name,
        total_score: Number(s.total_score),
        rank: 0,
      };
    });
  } else {
    // Akumulatif
    let query = supabase
      .from('cashier_cumulative_score')
      .select(
        'cashier_id, cumulative_score, cashier!inner(id, name, avatar_url, outlet!inner(id, branch_id, name, branch(name)))'
      )
      .in('cashier.outlet.branch_id', accessibleBranchIds);

    if (level === 'branch' && branchId) query = query.eq('cashier.outlet.branch_id', branchId);
    if (level === 'outlet' && outletId) query = query.eq('cashier.outlet_id', outletId);

    const { data } = await query.order('cumulative_score', { ascending: false });

    rows = (data ?? []).map((s) => {
      const cashier = s.cashier as unknown as {
        id: string;
        name: string;
        avatar_url: string | null;
        outlet: { id: string; name: string; branch_id: string; branch: { name: string } };
      };
      return {
        cashier_id: s.cashier_id,
        name: cashier.name,
        avatar_path: cashier.avatar_url,
        outlet_id: cashier.outlet.id,
        outlet_name: cashier.outlet.name,
        branch_id: cashier.outlet.branch_id,
        branch_name: cashier.outlet.branch.name,
        total_score: Number(s.cumulative_score),
        rank: 0,
      };
    });
  }

  // Tambahkan ranking
  rows = rows.map((row, i) => ({ ...row, rank: i + 1 }));

  const avatarUrls = await getCashierAvatarUrls(
    supabase,
    rows.map((row) => row.avatar_path)
  );

  const responseRows = rows.map(({ avatar_path, ...row }) => ({
    ...row,
    avatar_url: avatar_path ? (avatarUrls.get(avatar_path) ?? null) : null,
  }));

  return NextResponse.json({ rows: responseRows });
}
