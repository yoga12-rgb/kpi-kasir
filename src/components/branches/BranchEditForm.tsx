'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { getErrorMessage } from '@/lib/utils';

export function BranchEditForm({
  branchId,
  currentName,
  currentCode,
}: {
  branchId: string;
  currentName: string;
  currentCode: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [code, setCode] = useState(currentCode ?? '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: getErrorMessage(data.error, 'Gagal menyimpan') });
        setLoading(false);
        return;
      }

      setMessage({ type: 'success', text: 'Data cabang berhasil diperbarui' });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-surface-200 bg-white p-4">
      <Input
        label="Nama Cabang"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Contoh: Cabang Jakarta"
        required
        minLength={2}
      />
      <Input
        label="Kode (opsional)"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Contoh: JKT-01"
        maxLength={20}
      />
      {message && (
        <p className={message.type === 'success' ? 'text-sm text-success-600' : 'text-sm text-danger-600'}>
          {message.text}
        </p>
      )}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
      </Button>
    </form>
  );
}
