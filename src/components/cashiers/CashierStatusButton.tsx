'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { getErrorMessage } from '@/lib/utils';

interface CashierStatusButtonProps {
  cashierId: string;
  cashierName: string;
  outletName: string;
  isActive: boolean;
  canManageStatus: boolean;
}

export function CashierStatusButton({
  cashierId,
  cashierName,
  outletName,
  isActive,
  canManageStatus,
}: CashierStatusButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  if (!canManageStatus) {
    return (
      <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'Aktif' : 'Nonaktif'}</Badge>
    );
  }

  const actionLabel = isActive ? 'Nonaktifkan' : 'Aktifkan kembali';

  async function changeStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cashiers/${cashierId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive, reason }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string | { message?: string } }
        | null;

      if (!response.ok) {
        setError(
          typeof data?.error === 'object'
            ? getErrorMessage(data.error, 'Gagal mengubah status kasir')
            : (data?.error ?? 'Gagal mengubah status kasir')
        );
        return;
      }

      setOpen(false);
      setReason('');
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
          setReason('');
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`${actionLabel} kasir ${cashierName}`}
        title={actionLabel}
      >
        <Badge variant={isActive ? 'success' : 'muted'}>{isActive ? 'Aktif' : 'Nonaktif'}</Badge>
      </button>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={`${actionLabel} kasir?`}
      >
        <div className="space-y-3 text-sm text-surface-600">
          <p>
            Status kasir <strong className="font-semibold text-surface-900">{cashierName}</strong>{' '}
            di <strong className="font-semibold text-surface-900">{outletName}</strong> akan
            berubah menjadi {isActive ? 'nonaktif' : 'aktif'}.
          </p>
          <p>Riwayat status dan penempatan tetap tersimpan sebagai catatan audit.</p>
        </div>

        <div className="mt-4">
          <Textarea
            id="cashier-status-reason"
            label="Alasan perubahan"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: Kontrak kerja berakhir"
            minLength={3}
            maxLength={500}
            required
            disabled={loading}
          />
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
            variant={isActive ? 'danger' : 'primary'}
            fullWidth
            onClick={changeStatus}
            disabled={loading || reason.trim().length < 3}
          >
            {loading ? 'Memproses...' : actionLabel}
          </Button>
        </div>
      </Modal>
    </>
  );
}
