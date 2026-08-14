'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, CloudOff, Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Overlay';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { getErrorMessage, formatScore } from '@/lib/utils';
import {
  clearDraft,
  loadDraft,
  saveDraft,
  type DraftStorage,
} from '@/lib/assessment/draft';

const draftStorage: DraftStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

export interface CategoryWithDetails {
  id: string;
  name: string;
  weight: number;
  details: {
    id: string;
    name: string;
    type: 'scale' | 'deduction';
    scale_max: number | null;
    deduction_points: number | null;
    scale_value: number | null;
    normalized_score: number;
    assessment_id: string | null;
    deduction_events: { id: string; note: string | null; points: number; occurred_at: string }[];
  }[];
}

type SavingState = 'idle' | 'saving' | 'saved' | 'error';

export function AssessmentForm({
  cashierId,
  periodId,
  categories,
}: {
  cashierId: string;
  periodId: string;
  categories: CategoryWithDetails[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [savingState, setSavingState] = useState<SavingState>('idle');
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const cat of categories) {
      for (const d of cat.details) {
        if (d.type === 'scale' && d.scale_value !== null) {
          map[d.id] = String(d.scale_value);
        }
      }
    }
    return map;
  });

  const [deductionNotes, setDeductionNotes] = useState<Record<string, string>>({});
  const [draftAt, setDraftAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const draft = loadDraft(draftStorage, periodId, cashierId);
    if (draft) {
      setValues((prev) => ({ ...prev, ...draft.scaleValues }));
      setDeductionNotes((prev) => ({ ...prev, ...draft.deductionNotes }));
      setDraftAt(draft.updatedAt);
    }
    setHydrated(true);
  }, [periodId, cashierId]);

  /** Nilai skala yang sudah berubah dari nilai tersimpan server dan belum dikirim. */
  const pendingScaleDetails = useMemo(() => {
    const pending: { detailId: string; value: string }[] = [];
    for (const cat of categories) {
      for (const d of cat.details) {
        if (d.type !== 'scale') continue;
        const value = values[d.id] ?? '';
        if (value === '') continue;
        const saved = d.scale_value !== null ? String(d.scale_value) : '';
        if (value !== saved) pending.push({ detailId: d.id, value });
      }
    }
    return pending;
  }, [categories, values]);

  const pendingScaleCount = pendingScaleDetails.length;

  /** Ada perubahan lokal (draf) yang belum dikirim ke server. */
  const hasDraftChanges = useMemo(() => {
    return (
      pendingScaleCount > 0 ||
      Object.values(deductionNotes).some((note) => note.trim() !== '')
    );
  }, [pendingScaleCount, deductionNotes]);

  useEffect(() => {
    if (!hydrated) return;

    if (!hasDraftChanges) {
      clearDraft(draftStorage, periodId, cashierId);
      setDraftAt(null);
      return;
    }

    const handle = window.setTimeout(() => {
      const updatedAt = new Date().toISOString();
      saveDraft(draftStorage, periodId, cashierId, {
        scaleValues: values,
        deductionNotes,
        updatedAt,
      });
      setDraftAt(updatedAt);
    }, 400);

    return () => window.clearTimeout(handle);
  }, [hydrated, hasDraftChanges, values, deductionNotes, periodId, cashierId]);

  function discardDraft() {
    clearDraft(draftStorage, periodId, cashierId);
    setDeductionNotes({});
    setValues(() => {
      const map: Record<string, string> = {};
      for (const cat of categories) {
        for (const d of cat.details) {
          if (d.type === 'scale' && d.scale_value !== null) {
            map[d.id] = String(d.scale_value);
          }
        }
      }
      return map;
    });
    setDraftAt(null);
    setSavingState('idle');
    setToast({ message: 'Draf dibuang', variant: 'success' });
  }

  async function saveAll() {
    if (pendingScaleCount === 0 || loading) return;

    setLoading(true);
    setSavingState('saving');
    setToast(null);

    let succeeded = 0;
    let failed = 0;

    for (const { detailId, value } of pendingScaleDetails) {
      try {
        const res = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodId,
            cashierId,
            detailId,
            scaleValue: Number(value),
          }),
        });
        if (res.ok) {
          succeeded += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
    }

    void invalidateAppQueries(queryClient, [
      appQueryKeys.leaderboardRoot,
      appQueryKeys.cashierTabsRoot,
      appQueryKeys.assessmentListRoot,
    ]);
    router.refresh();

    if (failed > 0) {
      setSavingState('error');
      setToast({
        message: `${failed} dari ${succeeded + failed} nilai gagal disimpan. Perubahan tetap tersimpan sebagai draf.`,
        variant: 'error',
      });
    } else {
      setSavingState('saved');
      setToast({ message: 'Penilaian tersimpan', variant: 'success' });
    }

    setLoading(false);
  }

  async function addDeduction(detailId: string, assessmentId: string | null) {
    const note = deductionNotes[detailId] ?? '';
    setLoading(true);
    setToast(null);

    try {
      if (!assessmentId) {
        const initRes = await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodId,
            cashierId,
            detailId,
            scaleValue: null,
          }),
        });

        const initData = await initRes.json();
        if (!initRes.ok) {
          setToast({ message: getErrorMessage(initData.error, 'Gagal inisialisasi'), variant: 'error' });
          setLoading(false);
          return;
        }

        setToast({ message: 'Penilaian diinisialisasi', variant: 'success' });
        void invalidateAppQueries(queryClient, [
          appQueryKeys.leaderboardRoot,
          appQueryKeys.cashierTabsRoot,
          appQueryKeys.assessmentListRoot,
        ]);
        router.refresh();
        return;
      }

      const res = await fetch(`/api/assessments/${assessmentId}/deductions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ message: getErrorMessage(data.error, 'Gagal mencatat kejadian'), variant: 'error' });
        setLoading(false);
        return;
      }

      setDeductionNotes((prev) => ({ ...prev, [detailId]: '' }));
      setToast({ message: 'Kejadian deduksi dicatat', variant: 'success' });
      void invalidateAppQueries(queryClient, [
        appQueryKeys.leaderboardRoot,
        appQueryKeys.cashierTabsRoot,
        appQueryKeys.assessmentListRoot,
      ]);
      router.refresh();
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function removeDeduction(eventId: string) {
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch(`/api/deductions/${eventId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setToast({ message: getErrorMessage(data.error, 'Gagal menghapus'), variant: 'error' });
        setLoading(false);
        return;
      }

      setToast({ message: 'Kejadian dihapus', variant: 'success' });
      void invalidateAppQueries(queryClient, [
        appQueryKeys.leaderboardRoot,
        appQueryKeys.cashierTabsRoot,
        appQueryKeys.assessmentListRoot,
      ]);
      router.refresh();
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const statusMessage =
    savingState === 'saving'
      ? 'Menyimpan ke server…'
      : pendingScaleCount > 0
        ? `${pendingScaleCount} nilai belum disimpan ke server`
        : savingState === 'error'
          ? 'Sebagian nilai gagal disimpan'
          : savingState === 'saved'
            ? 'Penilaian tersimpan di server'
            : null;

  return (
    <div className="space-y-4">
      {/* Status sinkronisasi & aksi draf */}
      <div className="flex min-h-5 items-center justify-between gap-3">
        <p
          className={`flex items-center gap-1.5 text-xs ${
            pendingScaleCount > 0 || savingState === 'error'
              ? 'text-warning-600'
              : savingState === 'saved'
                ? 'text-success-600'
                : 'text-surface-500'
          }`}
          role="status"
          aria-live="polite"
        >
          {statusMessage && (pendingScaleCount > 0 || savingState === 'error') && (
            <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          {statusMessage}
        </p>
        {hasDraftChanges && pendingScaleCount === 0 && (
          <button
            type="button"
            className="text-xs text-surface-400 underline-offset-2 hover:text-surface-600 hover:underline"
            onClick={discardDraft}
          >
            Buang draf
          </button>
        )}
      </div>

      {categories.map((cat) => (
        <div key={cat.id} className="rounded-2xl border border-surface-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-surface-900">{cat.name}</h3>
            <Badge variant="info">Bobot {cat.weight}%</Badge>
          </div>

          <div className="space-y-4">
            {cat.details.map((detail) => {
              if (detail.type === 'scale') {
                const scaleMax = Number(detail.scale_max ?? 0);
                const scaleValue = values[detail.id] ?? '';
                const sliderValue = scaleValue === '' ? 0 : Number(scaleValue);
                const saved = detail.scale_value !== null ? String(detail.scale_value) : '';
                const isPending = scaleValue !== '' && scaleValue !== saved;

                return (
                  <div key={detail.id} className="rounded-xl bg-surface-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-surface-800">{detail.name}</p>
                        <p className="text-xs text-surface-500">
                          Skala 0–{detail.scale_max} · skor {formatScore(detail.normalized_score)}
                        </p>
                      </div>
                      {isPending && (
                        <Badge variant="warning">Belum tersimpan</Badge>
                      )}
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-surface-500">
                        <span>Nilai aktif</span>
                        <span className="text-lg font-bold tabular-nums text-primary-600">
                          {sliderValue.toFixed(1)}
                        </span>
                      </div>
                      <input
                        id={`scale-${detail.id}`}
                        type="range"
                        min={0}
                        max={scaleMax}
                        step={0.1}
                        value={sliderValue}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [detail.id]: e.target.value }))
                        }
                        aria-label={`Skor ${detail.name}`}
                        className="assessment-slider"
                        disabled={loading}
                      />
                      <div className="mt-1 flex justify-between text-[11px] text-surface-500">
                        <span>0.0</span>
                        <span>{scaleMax.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <Input
                        type="number"
                        min={0}
                        max={scaleMax}
                        step="0.1"
                        value={scaleValue}
                        onChange={(e) =>
                          setValues((prev) => ({ ...prev, [detail.id]: e.target.value }))
                        }
                        placeholder={`0–${detail.scale_max}`}
                        className="w-28"
                      />
                    </div>
                  </div>
                );
              }

              // Deduksi
              const totalPoints = detail.deduction_events.reduce(
                (acc, e) => acc + Number(e.points),
                0
              );
              const currentScore = Math.max(0, 100 - totalPoints);
              return (
                <div key={detail.id} className="rounded-xl bg-surface-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-surface-800">{detail.name}</p>
                      <p className="text-xs text-surface-500">
                        Deduksi -{detail.deduction_points} poin/kejadian
                      </p>
                    </div>
                    <Badge
                      variant={
                        currentScore > 75 ? 'success' : currentScore > 50 ? 'warning' : 'danger'
                      }
                    >
                      Skor {formatScore(currentScore)}
                    </Badge>
                  </div>

                  <div className="mt-2 space-y-1.5">
                    {detail.deduction_events.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm"
                      >
                        <span className="text-surface-600">
                          -{e.points} {e.note ? `· ${e.note}` : ''}
                        </span>
                        <button
                          type="button"
                          className="hover:text-danger-700 flex items-center gap-1 text-xs text-danger-600 hover:underline"
                          onClick={() => removeDeduction(e.id)}
                          disabled={loading}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    ))}
                    {detail.assessment_id && detail.deduction_events.length === 0 && (
                      <p className="text-xs text-surface-400">Belum ada kejadian deduksi.</p>
                    )}
                  </div>

                  <div className="mt-2 flex gap-2">
                    <Input
                      value={deductionNotes[detail.id] ?? ''}
                      onChange={(e) =>
                        setDeductionNotes((prev) => ({ ...prev, [detail.id]: e.target.value }))
                      }
                      placeholder="Catatan kejadian (opsional)"
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => addDeduction(detail.id, detail.assessment_id)}
                      disabled={loading || !detail.assessment_id}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Kejadian</span>
                    </Button>
                  </div>
                  {!detail.assessment_id && (
                    <div className="mt-1">
                      <p className="text-xs text-warning-600">
                        Inisialisasi penilaian untuk mulai mencatat kejadian deduksi.
                      </p>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="mt-1"
                        onClick={() => addDeduction(detail.id, null)}
                        disabled={loading}
                      >
                        Mulai (Skor 100)
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Aksi simpan terpusat */}
      <div className="sticky bottom-0 -mx-1 mt-2 flex items-center gap-3 border-t border-surface-200 bg-surface-50/95 px-1 py-3 backdrop-blur">
        <div className="min-w-0 flex-1 text-xs text-surface-500">
          {hasDraftChanges ? (
            <span className="flex items-center gap-1.5">
              <CircleAlert className="h-3.5 w-3.5 text-warning-600" aria-hidden="true" />
              Ada perubahan yang belum dikirim ke server
              {draftAt
                ? ` · draf ${new Date(draftAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </span>
          ) : (
            <span>Tidak ada perubahan.</span>
          )}
        </div>
        {hasDraftChanges && (
          <button
            type="button"
            className="shrink-0 text-xs text-surface-400 underline-offset-2 hover:text-surface-600 hover:underline"
            onClick={discardDraft}
          >
            Buang
          </button>
        )}
        <Button
          onClick={saveAll}
          disabled={loading || pendingScaleCount === 0}
          className="shrink-0"
        >
          {loading ? 'Menyimpan…' : pendingScaleCount > 0 ? `Simpan Penilaian (${pendingScaleCount})` : 'Simpan Penilaian'}
        </Button>
      </div>

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
