import Link from 'next/link';
import { SearchX } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-50 p-4 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-200/60 text-surface-500">
        <SearchX className="h-8 w-8" />
      </div>
      <h1 className="text-lg font-bold text-surface-900">Halaman tidak ditemukan</h1>
      <p className="mt-1 text-sm text-surface-500">Halaman yang kamu cari tidak ada.</p>
      <Link href="/dashboard" className="mt-4">
        <Button>Kembali ke Dashboard</Button>
      </Link>
    </div>
  );
}