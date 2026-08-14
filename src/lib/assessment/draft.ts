/**
 * Draft penilaian (autosave) berbasis penyimpanan client.
 *
 * Draft bersifat lokal dan tidak memengaruhi integritas skor: ia hanya
 * menyimpan input yang belum/gagal disubmit agar tidak hilang saat navigasi
 * atau koneksi terputus. Sumber kebenaran skor tetap API/RLS server.
 */

export interface AssessmentDraft {
  scaleValues: Record<string, string>;
  deductionNotes: Record<string, string>;
  updatedAt: string;
}

/** Abstraksi minimal agar mudah diuji tanpa jsdom. */
export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DRAFT_PREFIX = 'assessment-draft';

export function draftStorageKey(periodId: string, cashierId: string): string {
  return `${DRAFT_PREFIX}:${periodId}:${cashierId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toRecord(value: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!isRecord(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') result[key] = entry;
  }
  return result;
}

export function loadDraft(
  storage: DraftStorage,
  periodId: string,
  cashierId: string
): AssessmentDraft | null {
  const raw = storage.getItem(draftStorageKey(periodId, cashierId));
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    return {
      scaleValues: toRecord(parsed.scaleValues),
      deductionNotes: toRecord(parsed.deductionNotes),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveDraft(
  storage: DraftStorage,
  periodId: string,
  cashierId: string,
  draft: AssessmentDraft
): void {
  storage.setItem(draftStorageKey(periodId, cashierId), JSON.stringify(draft));
}

export function clearDraft(storage: DraftStorage, periodId: string, cashierId: string): void {
  storage.removeItem(draftStorageKey(periodId, cashierId));
}