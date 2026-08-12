'use client';

import { Archive, ArchiveRestore } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

interface CategoryStatusButtonProps {
  categoryId: string;
  categoryName: string;
  isActive: boolean;
}

export function CategoryStatusButton({
  categoryId,
  categoryName,
  isActive,
}: CategoryStatusButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionLabel = isActive ? 'Arsipkan' : 'Pulihkan';
  const Icon = isActive ? Archive : ArchiveRestore;

  async function changeStatus() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive, reason: reason.trim() }),
      });
      const data = (await response.json().catch(() => null)) as { error?: unknown } | null;

      if (!response.ok) {
        setError(getErrorMessage(data?.error, `Gagal ${actionLabel.toLowerCase()} indikator`));
        return;
      }

      setOpen(false);
      setReason('');
      router.refresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  function openDialog() {
    setError(null);
    setReason('');
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-500 transition-colors hover:border-primary-500 hover:text-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-label={`${actionLabel} indikator ${categoryName}`}
        title={actionLabel}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </button>

      <Modal
        open={open}
        onClose={() => !loading && setOpen(false)}
        title={`${actionLabel} indikator?`}
      >
        <div className="space-y-3 text-sm text-surface-600">
          <p>
            Indikator <strong className="font-semibold text-surface-900">{categoryName}</strong> akan
            menjadi {isActive ? 'arsip' : 'aktif'}.
          </p>
          <p>
            Penilaian lama dan periode berjalan tetap memakai snapshot. Tidak ada data penilaian
            yang dihapus.
          </p>
        </div>

        <div className="mt-4">
          <Textarea
            id="category-status-reason"
            label="Alasan perubahan"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: Diganti dengan konfigurasi penilaian baru"
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
