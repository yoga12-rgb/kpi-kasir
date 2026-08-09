'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Toast } from '@/components/ui/Overlay';
import { CashierAvatar } from '@/components/cashiers/CashierAvatar';
import { getErrorMessage } from '@/lib/utils';

export interface OutletOption {
  id: string;
  name: string;
  cashiers: { id: string; name: string }[];
}

export function MentoringForm({
  outlets,
  avatars = {},
}: {
  outlets: OutletOption[];
  avatars?: Record<string, string | null>;
}) {
  const router = useRouter();
  const [outletId, setOutletId] = useState('');
  const [visitedDate, setVisitedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteOutlet, setNoteOutlet] = useState('');
  const [cashierNotes, setCashierNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );

  const selectedOutlet = outlets.find((o) => o.id === outletId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setToast(null);

    const notes = Object.entries(cashierNotes)
      .filter(([, note]) => note.trim().length > 0)
      .map(([cashierId, note]) => ({ cashierId, note }));

    try {
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

      const data = await res.json();
      if (!res.ok) {
        setToast({ message: getErrorMessage(data.error, 'Gagal menyimpan'), variant: 'error' });
        setLoading(false);
        return;
      }

      setToast({ message: 'Sesi pendampingan tersimpan', variant: 'success' });
      router.push('/mentoring');
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
        required
      />
      <Textarea
        label="Catatan Umum Outlet (opsional)"
        value={noteOutlet}
        onChange={(e) => setNoteOutlet(e.target.value)}
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
                  placeholder="Catatan pendampingan kasir ini (opsional)"
                  className="min-h-[60px]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Button type="submit" fullWidth disabled={loading || !outletId}>
        {loading ? 'Menyimpan...' : 'Simpan Sesi'}
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
