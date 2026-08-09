'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Overlay';
import { getErrorMessage, formatScore } from '@/lib/utils';

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
  const [loading, setLoading] = useState(false);
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

  async function saveScale(detailId: string) {
    const value = values[detailId];
    if (value === undefined || value === '') {
      setToast({ message: 'Isi nilai skala terlebih dahulu', variant: 'error' });
      return;
    }

    setLoading(true);
    setToast(null);

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

      const data = await res.json();
      if (!res.ok) {
        setToast({ message: data.error ?? 'Gagal menyimpan', variant: 'error' });
        setLoading(false);
        return;
      }

      setToast({ message: 'Penilaian tersimpan', variant: 'success' });
      router.refresh();
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function addDeduction(detailId: string, assessmentId: string | null) {
    const note = deductionNotes[detailId] ?? '';
    setLoading(true);
    setToast(null);

    try {
      if (!assessmentId) {
        // Buat assessment awal (skor 100) untuk detail deduksi
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
          setToast({ message: initData.error ?? 'Gagal inisialisasi', variant: 'error' });
          setLoading(false);
          return;
        }

        setToast({ message: 'Penilaian diinisialisasi', variant: 'success' });
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
        setToast({ message: data.error ?? 'Gagal mencatat kejadian', variant: 'error' });
        setLoading(false);
        return;
      }

      setDeductionNotes((prev) => ({ ...prev, [detailId]: '' }));
      setToast({ message: 'Kejadian deduksi dicatat', variant: 'success' });
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
        setToast({ message: data.error ?? 'Gagal menghapus', variant: 'error' });
        setLoading(false);
        return;
      }

      setToast({ message: 'Kejadian dihapus', variant: 'success' });
      router.refresh();
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
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

                return (
                  <div key={detail.id} className="rounded-xl bg-surface-50 p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-surface-800">{detail.name}</p>
                        <p className="text-xs text-surface-500">
                          Skala 0–{detail.scale_max} · skor {formatScore(detail.normalized_score)}
                        </p>
                      </div>
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
                    <div className="mt-3 flex gap-2">
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
                      <Button size="sm" onClick={() => saveScale(detail.id)} disabled={loading}>
                        Simpan
                      </Button>
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
                    {/* Pastikan assessment untuk detail deduksi ada */}
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

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
