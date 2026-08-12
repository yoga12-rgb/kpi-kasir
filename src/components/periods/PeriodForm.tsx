'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { getErrorMessage, periodStartDate, periodEndDate } from '@/lib/utils';

export function PeriodForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = periodStartDate(new Date(year, monthNum - 1, 1));
    const endDate = periodEndDate(new Date(year, monthNum - 1, 1));

    try {
      const res = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate, endDate }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal membuka periode'));
        return;
      }

      setMonth('');
      void invalidateAppQueries(queryClient, [appQueryKeys.leaderboardRoot]);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-surface-200 bg-white p-4">
      <Input
        label="Periode (bulan)"
        type="month"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
        required
      />
      <p className="text-xs text-surface-500">
        Tutup periode aktif sebelumnya setelah preflight selesai sebelum membuka periode baru.
      </p>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Memproses...' : 'Buka Periode'}
      </Button>
    </form>
  );
}
