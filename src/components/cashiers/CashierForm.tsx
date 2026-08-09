'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

export function CashierForm({ outletId }: { outletId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [employmentStartDate, setEmploymentStartDate] = useState(() => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${today.getFullYear()}-${month}-${day}`;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, outletId, employmentStartDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal menyimpan');
        setLoading(false);
        return;
      }

      setName('');
      setEmploymentStartDate(() => {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${today.getFullYear()}-${month}-${day}`;
      });
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama kasir"
        required
        minLength={2}
        className="w-full"
      />
      <Input
        label="Mulai kerja"
        type="date"
        value={employmentStartDate}
        max={new Date().toISOString().slice(0, 10)}
        onChange={(e) => setEmploymentStartDate(e.target.value)}
        required
        className="w-full sm:w-40"
      />
      <Button type="submit" disabled={loading} className="sm:mt-6">
        {loading ? '...' : 'Simpan'}
      </Button>
      {error && <p className="text-xs text-danger-600 sm:col-span-3">{error}</p>}
    </form>
  );
}
