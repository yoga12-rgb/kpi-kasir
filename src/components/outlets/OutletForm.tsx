'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

export function OutletForm({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branchId, name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal menyimpan'));
        return;
      }

      setName('');
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nama outlet"
        required
        minLength={2}
        className="flex-1"
      />
      <Button type="submit" disabled={loading}>
        {loading ? '...' : 'Simpan'}
      </Button>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </form>
  );
}
