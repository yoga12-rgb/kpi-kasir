import { createClient } from '@/lib/supabase/server';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Validasi total bobot kategori aktif = 100%.
 * Dipanggil sebelum create/update kategori.
 */
export async function validateCategoryWeights(
  supabase: SupabaseClient
): Promise<{ valid: boolean; total: number }> {
  const { data } = await supabase.from('category').select('weight').eq('is_active', true);
  const total = (data ?? []).reduce((acc, c) => acc + Number(c.weight), 0);
  return { valid: Math.abs(total - 100) < 0.001, total };
}

/**
 * Validasi total bobot saat mengubah satu kategori (tanpa menyimpan).
 */
export async function validateCategoryWeightChange(
  supabase: SupabaseClient,
  categoryId: string,
  newWeight: number
): Promise<{ valid: boolean; total: number }> {
  const { data } = await supabase
    .from('category')
    .select('id, weight')
    .eq('is_active', true);

  const current = data ?? [];
  const others = current.filter((c) => c.id !== categoryId);
  const total = others.reduce((acc, c) => acc + Number(c.weight), 0) + newWeight;

  return { valid: Math.abs(total - 100) < 0.001, total };
}