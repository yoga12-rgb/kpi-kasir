'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { useQueryClient } from '@tanstack/react-query';
import { appQueryKeys, invalidateAppQueries } from '@/lib/client/query-keys';
import { withReturnTo } from '@/lib/navigation';
import { getErrorMessage } from '@/lib/utils';

export function BranchForm({ returnTo = '/branches' }: { returnTo?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(getErrorMessage(data.error, 'Gagal menyimpan'));
        setLoading(false);
        return;
      }

      void invalidateAppQueries(queryClient, [
        appQueryKeys.urlLists,
        appQueryKeys.inviteBranches,
        appQueryKeys.leaderboardRoot,
        appQueryKeys.mentoringSessionsRoot,
      ]);
      router.push(withReturnTo(`/branches/${data.branch.id}`, returnTo));
    } catch (err) {
      setError(getErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
      {error && <p className="text-sm text-danger-600">{error}</p>}
      <Button type="submit" fullWidth disabled={loading}>
        {loading ? 'Menyimpan...' : 'Simpan'}
      </Button>
    </form>
  );
}
