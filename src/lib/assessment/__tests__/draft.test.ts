import { describe, expect, it } from 'vitest';
import {
  draftStorageKey,
  loadDraft,
  saveDraft,
  clearDraft,
  type DraftStorage,
} from '../draft';

class MemoryStorage implements DraftStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

describe('assessment draft', () => {
  it('round-trips a draft keyed by period and cashier', () => {
    const storage = new MemoryStorage();
    const periodId = '11111111-1111-1111-1111-111111111111';
    const cashierId = '22222222-2222-2222-2222-222222222222';

    saveDraft(storage, periodId, cashierId, {
      scaleValues: { detail1: '4.5' },
      deductionNotes: { detail2: 'Terlambat' },
      updatedAt: '2026-08-14T00:00:00.000Z',
    });

    const loaded = loadDraft(storage, periodId, cashierId);
    expect(loaded).toEqual({
      scaleValues: { detail1: '4.5' },
      deductionNotes: { detail2: 'Terlambat' },
      updatedAt: '2026-08-14T00:00:00.000Z',
    });
  });

  it('isolates drafts between different cashiers and periods', () => {
    const storage = new MemoryStorage();
    const periodId = '11111111-1111-1111-1111-111111111111';

    saveDraft(storage, periodId, 'cashier-a', {
      scaleValues: { d: '1' },
      deductionNotes: {},
      updatedAt: 'x',
    });

    expect(loadDraft(storage, periodId, 'cashier-b')).toBeNull();
    expect(loadDraft(storage, 'other-period', 'cashier-a')).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    const storage = new MemoryStorage();
    const key = draftStorageKey('p', 'c');
    storage.setItem(key, '{not-json');

    expect(loadDraft(storage, 'p', 'c')).toBeNull();
  });

  it('drops non-string values when loading', () => {
    const storage = new MemoryStorage();
    const key = draftStorageKey('p', 'c');
    storage.setItem(
      key,
      JSON.stringify({ scaleValues: { ok: '1', bad: 2 }, deductionNotes: {} })
    );

    expect(loadDraft(storage, 'p', 'c')?.scaleValues).toEqual({ ok: '1' });
  });

  it('clears the stored draft', () => {
    const storage = new MemoryStorage();
    saveDraft(storage, 'p', 'c', { scaleValues: { d: '1' }, deductionNotes: {}, updatedAt: 'x' });

    clearDraft(storage, 'p', 'c');

    expect(loadDraft(storage, 'p', 'c')).toBeNull();
  });
});