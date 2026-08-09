/**
 * Perhitungan skor kategori.
 * Sesuai technical-spec.md §4:
 * - Skor kategori = rata-rata skor detail yang dinilai (setelah normalisasi)
 * - Jika tidak ada detail yang dinilai → dianggap 100 (skor penuh)
 */

export interface CategoryScoreInput {
  categoryId: string;
  weight: number;
  /** Skor normalisasi tiap detail yang sudah dinilai (0–100). */
  detailScores: number[];
}

export interface CategoryScoreResult {
  categoryId: string;
  weight: number;
  score: number;
  status: 'assessed' | 'full_credit';
}

export function calculateCategoryScore(input: CategoryScoreInput): CategoryScoreResult {
  const { categoryId, weight, detailScores } = input;

  if (detailScores.length === 0) {
    return {
      categoryId,
      weight,
      score: 100,
      status: 'full_credit',
    };
  }

  const sum = detailScores.reduce((acc, s) => acc + s, 0);
  const avg = sum / detailScores.length;

  return {
    categoryId,
    weight,
    score: Math.round(avg * 100) / 100,
    status: 'assessed',
  };
}

export interface FinalScoreInput {
  /**
   * Skor per kategori (sudah termasuk kategori yang dianggap 100).
   * Bobot dalam persen (misal 25 = 25%).
   */
  categoryScores: CategoryScoreResult[];
}

export function calculateFinalScore(input: FinalScoreInput): number {
  const totalWeight = input.categoryScores.reduce((acc, c) => acc + c.weight, 0);

  if (totalWeight === 0) {
    throw new Error('Total bobot kategori tidak boleh 0');
  }

  const weightedSum = input.categoryScores.reduce(
    (acc, c) => acc + c.score * c.weight,
    0
  );

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}