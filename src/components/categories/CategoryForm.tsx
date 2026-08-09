'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Info } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

export function CategoryForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const weightNum = Number(weight);

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
        label="Nama Kategori"
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
      <p className="flex items-start gap-1.5 text-xs text-surface-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
        <span>
          Perubahan bobot berlaku mulai <strong>periode berikutnya</strong> (tidak retroaktif).
        </span>
      </p>
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Menyimpan...' : 'Tambah Kategori'}
      </Button>
    </form>
  );
}
