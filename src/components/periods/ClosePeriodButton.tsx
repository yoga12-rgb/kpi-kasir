'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { getErrorMessage } from '@/lib/utils';

interface Preflight {
  status: 'open' | 'closed';
  configValid: boolean;
  configIssues: string[];
  incompleteCount: number;
  incompleteCashiers: Array<{
    cashier_name: string;
    outlet_name: string;
    status: string;
    assessed_details: number;
    total_details: number;
  }>;
  rankingPreview: Array<{ cashier_name: string; total_score: number }>;
}

export function ClosePeriodButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPreflight, setLoadingPreflight] = useState(false);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [overrideIncomplete, setOverrideIncomplete] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    setPreflight(null);
    setOverrideIncomplete(false);
    setOverrideReason('');
    setLoadingPreflight(true);

    try {
      const res = await fetch(`/api/periods/${periodId}/preflight`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal memuat preflight periode'));
      } else {
        setPreflight(data.preflight as Preflight);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoadingPreflight(false);
    }
  }

  async function handleClose() {
    if (preflight?.incompleteCount && overrideIncomplete && overrideReason.trim().length < 3) {
      setError('Alasan override wajib diisi.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/periods/${periodId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideIncomplete,
          overrideReason: overrideIncomplete ? overrideReason : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal menutup periode'));
        setLoading(false);
        return;
      }

      setOpen(false);
      void invalidateAppQueries(queryClient, [appQueryKeys.leaderboardRoot]);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpen}>
        Tutup
      </button>
      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Preflight Tutup Periode">
        {loadingPreflight && <p className="text-sm text-surface-500">Memuat pemeriksaan...</p>}
        {!loadingPreflight && preflight && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl bg-surface-100 p-3 text-surface-700">
              <p>
                Kasir incomplete: <strong>{preflight.incompleteCount}</strong>
              </p>
              <p>
                Konfigurasi snapshot: <strong>{preflight.configValid ? 'valid' : 'tidak valid'}</strong>
              </p>
            </div>

            {!preflight.configValid && (
              <ul className="list-disc space-y-1 pl-5 text-danger-600">
                {preflight.configIssues.map((issue) => <li key={issue}>{issue}</li>)}
              </ul>
            )}

            {preflight.incompleteCount > 0 && (
              <label className="flex items-start gap-2 text-surface-700">
                <input
                  type="checkbox"
                  checked={overrideIncomplete}
                  onChange={(event) => setOverrideIncomplete(event.target.checked)}
                  className="mt-1"
                />
                <span>Izinkan tutup meskipun ada kasir incomplete</span>
              </label>
            )}

            {overrideIncomplete && preflight.incompleteCount > 0 && (
              <Input
                label="Alasan override"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="Contoh: kasir cuti saat periode berjalan"
                required
              />
            )}

            {preflight.incompleteCount > 0 && !overrideIncomplete && (
              <p className="text-xs text-danger-600">
                Periode belum boleh ditutup sebelum semua kasir selesai atau override diaktifkan.
              </p>
            )}

            <p className="text-xs text-surface-500">
              Setelah ditutup, skor dikunci dan data roster menjadi leaderboard historis.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn btn-secondary flex-1"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-danger flex-1"
                onClick={handleClose}
                disabled={loading || !preflight.configValid || (preflight.incompleteCount > 0 && !overrideIncomplete)}
              >
                {loading ? 'Memproses...' : 'Tutup Periode'}
              </button>
            </div>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-danger-600">{error}</p>}
      </Modal>
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
    </>
  );
}
