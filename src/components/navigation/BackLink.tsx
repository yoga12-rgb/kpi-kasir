import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={`Kembali ke ${label}`}
      title={`Kembali ke ${label}`}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-surface-300 bg-white text-surface-600 transition-colors hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
