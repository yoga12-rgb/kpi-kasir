/**
 * Normalisasi nilai detail ke skala 0–100.
 * Sesuai technical-spec.md §4:
 * - Skala: scale_value / scale_max * 100
 * - Deduksi: 100 - total poin kejadian, floor di 0
 */

export interface NormalizeScaleInput {
  scaleValue: number;
  scaleMax: number;
}

export function normalizeScale({ scaleValue, scaleMax }: NormalizeScaleInput): number {
  if (scaleMax <= 0) {
    throw new Error('scaleMax harus lebih besar dari 0');
  }
  const normalized = (scaleValue / scaleMax) * 100;
  return Math.max(0, Math.min(100, normalized));
}

export function normalizeDeduction(totalPoints: number): number {
  return Math.max(0, 100 - totalPoints);
}

/** Gabungan: hitung skor normalisasi dari data detail. */
export function normalizeDetail(options: {
  type: 'scale' | 'deduction';
  scaleValue?: number | null;
  scaleMax?: number | null;
  totalDeductionPoints?: number;
}): number {
  if (options.type === 'scale') {
    if (options.scaleValue === null || options.scaleValue === undefined) {
      throw new Error('Detail tipe skala harus punya scaleValue');
    }
    if (!options.scaleMax) {
      throw new Error('Detail tipe skala harus punya scaleMax');
    }
    return normalizeScale({ scaleValue: options.scaleValue, scaleMax: options.scaleMax });
  }

  // deduction
  return normalizeDeduction(options.totalDeductionPoints ?? 0);
}