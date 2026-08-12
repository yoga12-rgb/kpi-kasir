'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

interface CategoryFormProps {
  activeWeightTotal: number;
}

export function CategoryForm({ activeWeightTotal }: CategoryFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weightNum = Number(weight || 0);
  const proposedTotal = activeWeightTotal + weightNum;
  const exceedsLimit = proposedTotal > 100.001;
  const remainingWeight = Math.max(0, 100 - proposedTotal);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (exceedsLimit) {
      setError(`Total bobot tidak boleh melebihi 100%. Kurangi ${Math.ceil((proposedTotal - 100) * 100) / 100}%.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, weight: weightNum }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal menyimpan'));
        return;
      }

      setName('');
      setWeight('');
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
        label="Nama Indikator"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Contoh: Pelayanan"
        required
        minLength={2}
      />
      <Input
        label="Bobot (%)"
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        placeholder="Contoh: 25"
        required
      />
      <p className={exceedsLimit ? 'text-xs text-danger-600' : 'text-xs text-surface-500'}>
        {exceedsLimit
          ? `Total setelah ditambahkan ${proposedTotal.toFixed(2)}%. Kurangi bobot agar tidak melebihi 100%.`
          : `Total setelah ditambahkan ${proposedTotal.toFixed(2)}%. Sisa bobot ${remainingWeight.toFixed(2)}%.`}
      </p>
      <p className="flex items-start gap-1.5 text-xs text-surface-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
        <span>
          Total bobot harus tepat <strong>100%</strong> sebelum periode dapat dibuka. Perubahan bobot berlaku mulai{' '}
          <strong>periode berikutnya</strong> (tidak retroaktif).
        </span>
      </p>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" fullWidth disabled={loading || exceedsLimit}>
        {loading ? 'Menyimpan...' : 'Tambah Indikator'}
      </Button>
    </form>
  );
}
