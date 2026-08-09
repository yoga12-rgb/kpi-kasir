import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

const cashierSchema = z.object({
  name: z.string().trim().min(2).max(100),
  outletId: z.string().uuid(),
  employmentStartDate: z.string().date(),
});

export async function GET(request: Request) {
  await requirePermission('cashiers.view');
  const { searchParams } = new URL(request.url);
  const outletId = searchParams.get('outletId');
  const branchId = searchParams.get('branchId');

  const supabase = await createClient();
  let query = supabase
    .from('cashier')
    .select('*, outlet!inner(name, branch:branch(name))')
    .eq('is_active', true)
    .order('name');

  if (outletId) query = query.eq('outlet_id', outletId);
  if (branchId) query = query.eq('outlet.branch_id', branchId);

  const { data } = await query;
  return NextResponse.json({ cashiers: data ?? [] });
}

export async function POST(request: Request) {
  await requirePermission('cashiers.create');
  const body = await request.json().catch(() => null);
  const parsed = cashierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 });
  }

  if (parsed.data.employmentStartDate > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: 'Tanggal mulai kerja tidak boleh lebih dari hari ini' },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const cashierId = randomUUID();

  // Buat kasir + riwayat penempatan awal
  const { error } = await supabase.from('cashier').insert({
    id: cashierId,
    name: parsed.data.name,
    outlet_id: parsed.data.outletId,
    employment_start_date: parsed.data.employmentStartDate,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { error: historyError } = await supabase
    .from('cashier_outlet_history')
    .insert({ cashier_id: cashierId, outlet_id: parsed.data.outletId });

  if (historyError) {
    return NextResponse.json({ error: historyError.message }, { status: 400 });
  }

  return NextResponse.json(
    {
      cashier: {
        id: cashierId,
        name: parsed.data.name,
        outlet_id: parsed.data.outletId,
        employment_start_date: parsed.data.employmentStartDate,
      },
    },
    { status: 201 }
  );
}
