'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/utils';

interface CashierStatusButtonProps {
  cashierId: string;
  cashierName: string;
  outletName: string;
  isActive: boolean;
  canDeactivate: boolean;
}

export function CashierStatusButton({
  cashierId,
  cashierName,
  outletName,
  isActive,
  canDeactivate,
}: CashierStatusButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isActive || !canDeactivate) {
    return (
      <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'Aktif' : 'Nonaktif'}</Badge>
    );
  }

  async function deactivateCashier() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cashiers/${cashierId}`, { method: 'DELETE' });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? 'Gagal menonaktifkan kasir');
        return;
      }

      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded-full focus:outline-none focus:ring-2 focus:ring-danger-500/50"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Nonaktifkan kasir ${cashierName}`}
        title="Nonaktifkan kasir"
      >
        <Badge variant="success">Aktif</Badge>
      </button>

      <Modal open={open} onClose={() => !loading && setOpen(false)} title="Nonaktifkan kasir?">
        <div className="space-y-3 text-sm text-surface-600">
          <p>
            Kasir <strong className="font-semibold text-surface-900">{cashierName}</strong> di{' '}
            <strong className="font-semibold text-surface-900">{outletName}</strong> akan menjadi
            nonaktif.
          </p>
          <p>Data penilaian, foto, pendampingan, dan riwayat penempatan tetap tersimpan.</p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            fullWidth
            onClick={deactivateCashier}
            disabled={loading}
          >
            {loading ? 'Memproses...' : 'Nonaktifkan'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
