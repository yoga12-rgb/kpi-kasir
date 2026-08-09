'use client';

import { Check, Pencil, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/utils';

export function CashierNameEditForm({
  cashierId,
  name,
  canEdit,
}: {
  cashierId: string;
  name: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <div className="mx-auto flex h-9 items-center justify-center">
        <h1 className="text-xl font-semibold tracking-tight text-surface-900">{name}</h1>
      </div>
    );
  }

  async function saveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = value.trim();
    if (nextName.length < 2) {
      setError('Nama kasir minimal 2 karakter');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cashiers/${cashierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nextName }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? 'Gagal mengubah nama kasir');
        return;
      }

      setValue(nextName);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function cancelEdit() {
    setValue(name);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="relative mx-auto h-9 max-w-full">
        <form onSubmit={saveName} className="flex h-9 items-center justify-center gap-2">
          <label htmlFor="cashier-name" className="sr-only">
            Nama kasir
          </label>
          <input
            id="cashier-name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="input h-9 w-52 max-w-full px-3 text-center text-base font-semibold"
            minLength={2}
            maxLength={100}
            required
            autoFocus
            disabled={loading}
          />
          <Button
            type="submit"
            size="sm"
            className="h-9 w-9 shrink-0 p-0"
            disabled={loading}
            aria-label="Simpan nama kasir"
            title="Simpan nama kasir"
          >
            <Check className="h-4 w-4" />
          </Button>
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-300 text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-800 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50"
            onClick={cancelEdit}
            disabled={loading}
            aria-label="Batal mengubah nama kasir"
            title="Batal"
          >
            <X className="h-4 w-4" />
          </button>
        </form>
        {error && (
          <p className="absolute left-0 right-0 top-full mt-1 text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="relative mx-auto h-9">
      <div className="flex h-9 items-center justify-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-surface-900">{name}</h1>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-surface-100 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          onClick={() => setEditing(true)}
          aria-label="Edit nama kasir"
          title="Edit nama kasir"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
