import { Skeleton } from '@/components/ui/Feedback';

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-4" role="status" aria-label="Memuat halaman">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>

      <div className="rounded-2xl border border-surface-200 bg-white p-4">
        <Skeleton className="h-5 w-36" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
