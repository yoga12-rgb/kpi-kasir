import { Skeleton } from '@/components/ui/Feedback';

function MetricSkeleton() {
  return (
    <div className="card min-h-32">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-3 w-32" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Memuat dashboard">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MetricSkeleton />
        <MetricSkeleton />
      </div>
      <div className="card space-y-3">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}
