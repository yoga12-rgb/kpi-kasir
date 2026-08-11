'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Toast } from '@/components/ui/Overlay';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import {
  MentoringEvidencePicker,
  type MentoringEvidenceDraft,
} from '@/components/mentoring/MentoringEvidencePicker';
import { getErrorMessage } from '@/lib/utils';

export interface OutletOption {
  id: string;
  name: string;
  cashiers: { id: string; name: string }[];
}

export function MentoringForm({
  outlets,
  avatars = {},
  evidenceUploadEnabled = false,
}: {
  outlets: OutletOption[];
  avatars?: Record<string, string | null>;
  evidenceUploadEnabled?: boolean;
}) {
  const router = useRouter();
  const [outletId, setOutletId] = useState('');
  const [visitedDate, setVisitedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteOutlet, setNoteOutlet] = useState('');
  const [cashierNotes, setCashierNotes] = useState<Record<string, string>>({});
  const [evidenceDrafts, setEvidenceDrafts] = useState<MentoringEvidenceDraft[]>([]);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);
  const [uploadFailures, setUploadFailures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );

  const selectedOutlet = outlets.find((o) => o.id === outletId);

  async function uploadEvidence(sessionId: string, drafts: MentoringEvidenceDraft[]) {
    const failures: string[] = [];

    for (const [index, draft] of drafts.entries()) {
      if (draft.status !== 'ready' || !draft.uploadFile) continue;

      const formData = new FormData();
      formData.append('file', draft.uploadFile, draft.uploadFile.name);

      try {
        const response = await fetch(`/api/mentoring-sessions/${sessionId}/evidence`, {
          method: 'POST',
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, `Bukti foto ${index + 1} gagal diupload`));
        }
      } catch (error) {
        failures.push(`Foto ${index + 1}: ${getErrorMessage(error, 'Upload gagal')}`);
      }
    }

    return failures;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    if (!createdSessionId) {
      const notReady = evidenceDrafts.some((draft) => draft.status !== 'ready');
      if (notReady) {
        setToast({
          message: 'Tunggu kompresi selesai atau hapus foto yang gagal diproses.',
          variant: 'error',
        });
        return;
      }
    }

    setLoading(true);

    const notes = Object.entries(cashierNotes)
      .filter(([, note]) => note.trim().length > 0)
      .map(([cashierId, note]) => ({ cashierId, note }));

    try {
      let sessionId = createdSessionId;
      if (!sessionId) {
        const res = await fetch('/api/mentoring-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            outletId,
            visitedDate,
            noteOutlet: noteOutlet || null,
            cashierNotes: notes,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setToast({
            message: getErrorMessage(data, 'Gagal menyimpan sesi'),
            variant: 'error',
          });
          setLoading(false);
          return;
        }

        const returnedSessionId =
          data?.session && typeof data.session.id === 'string' ? data.session.id : null;
        if (!returnedSessionId) throw new Error('Respons sesi tidak valid');
        sessionId = returnedSessionId;
        setCreatedSessionId(returnedSessionId);
      }

      if (!sessionId) throw new Error('ID sesi tidak tersedia');

      const failures = await uploadEvidence(sessionId, evidenceDrafts);
      if (failures.length > 0) {
        setUploadFailures(failures);
        setToast({
          message: 'Sesi tersimpan, tetapi sebagian bukti foto belum berhasil diupload.',
          variant: 'error',
        });
        setLoading(false);
        return;
      }

      setUploadFailures([]);
      setToast({ message: 'Sesi pendampingan tersimpan', variant: 'success' });
      router.push(`/mentoring/${sessionId}`);
      router.refresh();
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Outlet"
        value={outletId}
        onChange={(e) => {
          setOutletId(e.target.value);
          setCashierNotes({});
        }}
        disabled={loading || !!createdSessionId}
        options={[
          { value: '', label: 'Pilih outlet...' },
          ...outlets.map((o) => ({ value: o.id, label: o.name })),
        ]}
        required
      />
      <Input
        label="Tanggal"
        type="date"
        value={visitedDate}
        onChange={(e) => setVisitedDate(e.target.value)}
        disabled={loading || !!createdSessionId}
        required
      />
      <Textarea
        label="Catatan Umum Outlet (opsional)"
        value={noteOutlet}
        onChange={(e) => setNoteOutlet(e.target.value)}
        disabled={loading || !!createdSessionId}
        placeholder="Catatan kualitatif untuk outlet"
      />

      {selectedOutlet && (
        <div className="rounded-xl border border-surface-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-surface-900">Catatan per Kasir</h3>
          {selectedOutlet.cashiers.length === 0 && (
            <p className="text-sm text-surface-500">Outlet ini belum punya kasir.</p>
          )}
          <div className="space-y-3">
            {selectedOutlet.cashiers.map((cashier) => (
              <div key={cashier.id}>
                <div className="mb-1 flex items-center gap-2">
                  <CashierAvatar name={cashier.name} src={avatars[cashier.id] ?? null} size={28} />
                  <span className="text-sm font-medium text-surface-700">{cashier.name}</span>
                </div>
                <Textarea
                  value={cashierNotes[cashier.id] ?? ''}
                  onChange={(e) =>
                    setCashierNotes((prev) => ({ ...prev, [cashier.id]: e.target.value }))
                  }
                  disabled={loading || !!createdSessionId}
                  placeholder="Catatan pendampingan kasir ini (opsional)"
                  className="min-h-[60px]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {evidenceUploadEnabled && (
        <MentoringEvidencePicker disabled={loading} onChange={setEvidenceDrafts} />
      )}

      {createdSessionId && uploadFailures.length > 0 && (
        <div
          className="border-danger-200 bg-danger-50 text-danger-700 rounded-xl border p-4 text-sm"
          role="alert"
        >
          <p className="font-semibold">Sesi sudah tersimpan.</p>
          <p className="mt-1">
            Perbaiki koneksi atau pilih ulang foto, lalu tekan tombol di bawah untuk mencoba lagi.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {uploadFailures.map((failure) => (
              <li key={failure}>{failure}</li>
            ))}
          </ul>
          <a
            href={`/mentoring/${createdSessionId}`}
            className="text-danger-800 mt-3 inline-flex font-medium underline underline-offset-2"
          >
            Buka sesi tanpa menunggu foto
          </a>
        </div>
      )}

      <Button type="submit" fullWidth disabled={loading || (!createdSessionId && !outletId)}>
        {loading
          ? createdSessionId
            ? 'Mengupload foto...'
            : 'Menyimpan sesi...'
          : createdSessionId
            ? 'Coba Upload Lagi'
            : 'Simpan Sesi'}
      </Button>

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </form>
  );
}
