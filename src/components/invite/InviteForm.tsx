'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { Toast } from '@/components/ui/Overlay';
import { appQueryKeys } from '@/lib/client/query-keys';
import { getErrorMessage } from '@/lib/utils';

interface BranchOption {
  id: string;
  name: string;
}

export function InviteForm({ branches }: { branches: BranchOption[] }) {
  const queryClient = useQueryClient();
  const [inviteName, setInviteName] = useState('');
  const [role, setRole] = useState<'manager' | 'supervisor'>('manager');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(
    null
  );

  function toggleBranch(id: string) {
    setSelectedBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setToast(null);
    setLink(null);

    try {
      const res = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteName, role, branchIds: selectedBranches }),
      });

      const data = await res.json();
      if (!res.ok) {
        setToast({ message: getErrorMessage(data.error, 'Gagal membuat undangan'), variant: 'error' });
        setLoading(false);
        return;
      }

      setLink(data.link);
      setToast({ message: 'Link undangan dibuat', variant: 'success' });
      setInviteName('');
      setSelectedBranches([]);
      await queryClient.invalidateQueries({ queryKey: appQueryKeys.invitesRoot });
    } catch (err) {
      setToast({ message: getErrorMessage(err), variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setToast({ message: 'Link disalin', variant: 'success' });
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-surface-200 bg-white p-4"
      >
        <Input
          label="Nama Pengguna"
          value={inviteName}
          onChange={(e) => setInviteName(e.target.value)}
          placeholder="Nama lengkap pengguna"
          required
        />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as 'manager' | 'supervisor')}
          options={[
            { value: 'manager', label: 'Manager' },
            { value: 'supervisor', label: 'Supervisor' },
          ]}
        />
        <div>
          <span className="label">Cabang (bisa lebih dari satu)</span>
          <div className="space-y-1.5">
            {branches.map((b) => (
              <label
                key={b.id}
                className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedBranches.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                  className="h-4 w-4 rounded border-surface-300 text-primary-600"
                />
                {b.name}
              </label>
            ))}
            {branches.length === 0 && <p className="text-xs text-surface-400">Belum ada cabang.</p>}
          </div>
        </div>
        {selectedBranches.length === 0 && (
          <p className="text-xs text-warning-600">Pilih minimal satu cabang.</p>
        )}
        <Button
          type="submit"
          fullWidth
          disabled={loading || !inviteName.trim() || selectedBranches.length === 0}
        >
          {loading ? 'Membuat...' : 'Buat Link Undangan'}
        </Button>
      </form>

      {link && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4">
          <p className="mb-2 text-sm font-medium text-primary-800">
            Link Undangan (berlaku 7 hari):
          </p>
          <p className="mb-2 break-all rounded-lg bg-white p-2 text-xs text-surface-700">{link}</p>
          <Button size="sm" variant="secondary" onClick={copyLink}>
            Salin Link
          </Button>
        </div>
      )}

      <Toast
        open={!!toast}
        message={toast?.message ?? ''}
        variant={toast?.variant ?? 'info'}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
