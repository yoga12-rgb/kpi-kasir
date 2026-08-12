'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

interface CategoryEditFormProps {
  categoryId: string;
  initialName: string;
  initialWeight: number;
  otherActiveWeightTotal: number;
}

export function CategoryEditForm({
  categoryId,
  initialName,
  initialWeight,
  otherActiveWeightTotal,
}: CategoryEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [weight, setWeight] = useState(String(initialWeight));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initialName);
    setWeight(String(initialWeight));
  }, [initialName, initialWeight]);

  const weightNum = Number(weight || 0);
  const proposedTotal = otherActiveWeightTotal + weightNum;
  const exceedsLimit = proposedTotal > 100.001;
  const remainingWeight = Math.max(0, 100 - proposedTotal);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (exceedsLimit) {
      setError(`Total bobot tidak boleh melebihi 100%. Kurangi ${Math.ceil((proposedTotal - 100) * 100) / 100}%.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, weight: weightNum }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(getErrorMessage(data.error, 'Gagal memperbarui indikator'));
        return;
      }

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
        onChange={(event) => setName(event.target.value)}
        required
        minLength={2}
        maxLength={100}
      />
      <Input
        label="Bobot (%)"
        type="number"
        min={0}
        max={100}
        step="0.01"
        value={weight}
        onChange={(event) => setWeight(event.target.value)}
        required
      />
      <p className={exceedsLimit ? 'text-xs text-danger-600' : 'text-xs text-surface-500'}>
        {exceedsLimit
          ? `Total aktif akan menjadi ${proposedTotal.toFixed(2)}%. Kurangi bobot agar tidak melebihi 100%.`
          : `Total aktif setelah disimpan ${proposedTotal.toFixed(2)}%. Sisa bobot ${remainingWeight.toFixed(2)}%.`}
      </p>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" fullWidth disabled={loading || exceedsLimit}>
        {loading ? 'Menyimpan...' : 'Simpan Indikator'}
      </Button>
    </form>
  );
}
