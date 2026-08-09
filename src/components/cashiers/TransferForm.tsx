'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

interface OutletOption {
  id: string;
  name: string;
}

export function TransferForm({ cashierId, currentOutletId, outlets }: { cashierId: string; currentOutletId: string; outlets: OutletOption[] }) {
  const router = useRouter();
  const [outletId, setOutletId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eligibleOutlets = outlets.filter((o) => o.id !== currentOutletId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!outletId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/cashiers/${cashierId}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal mutasi');
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Select
        label="Outlet Tujuan"
        value={outletId}
        onChange={(e) => setOutletId(e.target.value)}
        options={[
          { value: '', label: 'Pilih outlet...' },
          ...eligibleOutlets.map((o) => ({ value: o.id, label: o.name })),
        ]}
        required
      />
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" disabled={loading || !outletId}>
        {loading ? 'Memproses...' : 'Mutasi Outlet'}
      </Button>
    </form>
  );
}