'use client';

import { AlertOctagon } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
        <AlertOctagon className="h-8 w-8" />
      </div>
      <h1 className="text-lg font-bold text-surface-900">Terjadi kesalahan</h1>
      <p className="mt-1 text-sm text-surface-500">{error.message || 'Silakan coba lagi.'}</p>
      <Button className="mt-4" onClick={reset}>
        Coba Lagi
      </Button>
    </div>
  );
}