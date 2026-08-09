import { describe, expect, it } from 'vitest';
import { calculateCategoryScore, calculateFinalScore } from '../category';

describe('calculateCategoryScore', () => {
  it('kategori tanpa detail dinilai dianggap skor penuh (100)', () => {
    const result = calculateCategoryScore({
      categoryId: 'cat-a',
      weight: 40,
      detailScores: [],
    });
    expect(result.score).toBe(100);
    expect(result.status).toBe('full_credit');
  });

  it('rata-rata skor detail yang dinilai', () => {
    const result = calculateCategoryScore({
      categoryId: 'cat-a',
      weight: 40,
      detailScores: [80, 100],
    });
    expect(result.score).toBe(90);
    expect(result.status).toBe('assessed');
  });

  it('satu detail saja', () => {
    const result = calculateCategoryScore({
      categoryId: 'cat-a',
      weight: 40,
      detailScores: [90],
    });
    expect(result.score).toBe(90);
  });
});

describe('calculateFinalScore', () => {
  it('menghitung skor akhir = Σ(skor kategori × bobot)', () => {
    // Contoh kasus dari milestone.md M4:
    // Kategori A bobot 40% → 90
    // Kategori B bobot 60% → 90
    // Skor akhir = (90 × 0.40) + (90 × 0.60) = 90
    const result = calculateFinalScore({
      categoryScores: [
        { categoryId: 'a', weight: 40, score: 90, status: 'assessed' },
        { categoryId: 'b', weight: 60, score: 90, status: 'assessed' },
      ],
    });
    expect(result).toBe(90);
  });

  it('bobot campuran menghasilkan rata-rata tertimbang', () => {
    const result = calculateFinalScore({
      categoryScores: [
        { categoryId: 'a', weight: 25, score: 100, status: 'full_credit' },
        { categoryId: 'b', weight: 75, score: 80, status: 'assessed' },
      ],
    });
    // (100 × 0.25) + (80 × 0.75) = 25 + 60 = 85
    expect(result).toBe(85);
  });

  it('kategori belum dinilai = 100 ikut dihitung penuh', () => {
    const result = calculateFinalScore({
      categoryScores: [
        { categoryId: 'a', weight: 50, score: 100, status: 'full_credit' },
        { categoryId: 'b', weight: 50, score: 100, status: 'full_credit' },
      ],
    });
    expect(result).toBe(100);
  });

  it('melempar error jika total bobot 0', () => {
    expect(() =>
      calculateFinalScore({
        categoryScores: [{ categoryId: 'a', weight: 0, score: 100, status: 'full_credit' }],
      })
    ).toThrow('Total bobot kategori tidak boleh 0');
  });
});