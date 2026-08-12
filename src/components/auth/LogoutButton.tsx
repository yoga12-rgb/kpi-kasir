'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { signOutAction } from '@/app/(app)/actions';

export function LogoutButton() {
  const queryClient = useQueryClient();

  return (
    <form action={signOutAction} onSubmit={() => queryClient.clear()} className="mt-6">
      <button
        type="submit"
        className="flex w-full items-center gap-4 rounded-lg border border-danger-500/20 bg-white p-4 text-left transition-colors hover:bg-danger-500/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-500/10 text-danger-600">
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-surface-900">Keluar</span>
          <span className="block text-sm text-surface-500">Akhiri sesi akun ini</span>
        </span>
      </button>
    </form>
  );
}
