'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { getErrorMessage } from '@/lib/utils';

export function OutletEditForm({
  outletId,
  currentName,
}: {
  outletId: string;
  currentName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/outlets/${outletId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: getErrorMessage(data.error, 'Gagal menyimpan') });
        return;
      }

      setMessage({ type: 'success', text: 'Nama outlet berhasil diperbarui' });
      void invalidateAppQueries(queryClient, [
        appQueryKeys.urlLists,
        appQueryKeys.leaderboardRoot,
        appQueryKeys.mentoringSessionsRoot,
      ]);
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: getErrorMessage(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-surface-200 bg-white p-4"
    >
      <Input
        label="Nama Outlet"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Contoh: Outlet Dago"
        required
        minLength={2}
      />
      {message && (
        <p
          className={
            message.type === 'success' ? 'text-sm text-success-600' : 'text-sm text-danger-600'
          }
        >
          {message.text}
        </p>
      )}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
      </Button>
    </form>
  );
}
