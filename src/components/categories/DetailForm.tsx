'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

export function DetailForm({ categoryId }: { categoryId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<'scale' | 'deduction'>('scale');
  const [scaleMax, setScaleMax] = useState('');
  const [deductionPoints, setDeductionPoints] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body = {
      name,
      type,
      scaleMax: type === 'scale' ? Number(scaleMax) : null,
      deductionPoints: type === 'deduction' ? Number(deductionPoints) : null,
    };

    try {
      const res = await fetch(`/api/categories/${categoryId}/details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = data?.details
          ? 'Data tidak valid. Detail skala wajib punya skala maks; detail deduksi wajib punya poin.'
          : getErrorMessage(data.error, 'Gagal menyimpan');
        setError(msg);
        setLoading(false);
        return;
      }

      setName('');
      setScaleMax('');
      setDeductionPoints('');
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-surface-200 bg-white p-4">
      <Input
        label="Nama Detail"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Contoh: Keramahan"
        required
        minLength={2}
      />
      <Select
        label="Tipe"
        value={type}
        onChange={(e) => setType(e.target.value as 'scale' | 'deduction')}
        options={[
          { value: 'scale', label: 'Skala' },
          { value: 'deduction', label: 'Deduksi' },
        ]}
      />
      {type === 'scale' ? (
        <Input
          label="Skala Maksimal"
          type="number"
          min={1}
          step="0.01"
          value={scaleMax}
          onChange={(e) => setScaleMax(e.target.value)}
          placeholder="Contoh: 5"
          required
        />
      ) : (
        <Input
          label="Poin per Kejadian"
          type="number"
          min={1}
          step="0.01"
          value={deductionPoints}
          onChange={(e) => setDeductionPoints(e.target.value)}
          placeholder="Contoh: 5"
          required
        />
      )}
      <p className="text-xs text-surface-500">
        {type === 'scale'
          ? 'Nilai dinormalisasi ke 0–100 berdasarkan skala maksimal.'
          : 'Deduksi mulai dari 100, dikurangi poin tiap kejadian (floor 0).'}
      </p>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Menyimpan...' : 'Tambah Detail'}
      </Button>
    </form>
  );
}
