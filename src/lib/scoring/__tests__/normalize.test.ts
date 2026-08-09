import { describe, expect, it } from 'vitest';
import { normalizeDeduction, normalizeDetail, normalizeScale } from '../normalize';

describe('normalizeScale', () => {
  it('menghitung persentase dengan benar', () => {
    expect(normalizeScale({ scaleValue: 4, scaleMax: 5 })).toBe(80);
    expect(normalizeScale({ scaleValue: 5, scaleMax: 5 })).toBe(100);
    expect(normalizeScale({ scaleValue: 0, scaleMax: 5 })).toBe(0);
    expect(normalizeScale({ scaleValue: 3, scaleMax: 10 })).toBe(30);
  });

  it('membatasi nilai di luar rentang 0-100', () => {
    expect(normalizeScale({ scaleValue: 10, scaleMax: 5 })).toBe(100);
  });

  it('melempar error jika scaleMax <= 0', () => {
    expect(() => normalizeScale({ scaleValue: 1, scaleMax: 0 })).toThrow(
      'scaleMax harus lebih besar dari 0'
    );
  });
});

describe('normalizeDeduction', () => {
  it('100 dikurangi total poin', () => {
    expect(normalizeDeduction(0)).toBe(100);
    expect(normalizeDeduction(10)).toBe(90);
    expect(normalizeDeduction(50)).toBe(50);
  });

  it('floor di 0 (tidak negatif)', () => {
    expect(normalizeDeduction(150)).toBe(0);
    expect(normalizeDeduction(100)).toBe(0);
  });
});

describe('normalizeDetail', () => {
  it('tipe skala menggunakan normalisasi skala', () => {
    expect(normalizeDetail({ type: 'scale', scaleValue: 4, scaleMax: 5 })).toBe(80);
  });

  it('tipe deduksi menggunakan normalisasi deduksi', () => {
    expect(normalizeDetail({ type: 'deduction', totalDeductionPoints: 10 })).toBe(90);
    expect(normalizeDetail({ type: 'deduction', totalDeductionPoints: 500 })).toBe(0);
  });

  it('melempar error jika skala tanpa scaleValue', () => {
    expect(() => normalizeDetail({ type: 'scale', scaleValue: null, scaleMax: 5 })).toThrow(
      'Detail tipe skala harus punya scaleValue'
    );
  });

  it('deduksi tanpa total poin default 0', () => {
    expect(normalizeDetail({ type: 'deduction' })).toBe(100);
  });
});