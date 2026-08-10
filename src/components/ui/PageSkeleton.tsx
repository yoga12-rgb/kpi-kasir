import { Skeleton } from '@/components/ui/Feedback';

export function ListPageSkeleton({
  rows = 5,
  search = true,
}: {
  rows?: number;
  search?: boolean;
}) {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Memuat konten">
      <div>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-3 w-52" />
      </div>
      {search && (
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="card">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-2 h-3 w-3/5" />
            <Skeleton className="mt-3 h-3 w-1/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-busy="true" aria-label="Memuat detail">
      <Skeleton className="h-4 w-24" />
      <div className="card space-y-4">
        <div className="flex flex-col items-center">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="mt-4 h-5 w-40" />
          <Skeleton className="mt-2 h-3 w-52" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="card space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
    </div>
  );
}
