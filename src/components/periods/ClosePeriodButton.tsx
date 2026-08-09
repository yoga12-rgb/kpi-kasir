'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/utils';

export function ClosePeriodButton({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/periods/${periodId}/close`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal menutup periode');
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Tutup
      </button>
      <ConfirmDialog
        open={open}
        title="Tutup Periode"
        message="Periode akan ditutup dan skor terkunci menjadi leaderboard. Lanjutkan?"
        confirmLabel="Ya, Tutup"
        danger
        onConfirm={handleClose}
        onCancel={() => setOpen(false)}
        loading={loading}
      />
      {error && <p className="mt-2 text-xs text-danger-600">{error}</p>}
    </>
  );
}