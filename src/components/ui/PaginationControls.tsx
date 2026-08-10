import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NavigationLink } from '@/components/ui/NavigationLink';

interface PaginationControlsProps {
  pathname: string;
  params?: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}

function pageHref(pathname: string, params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  Object.entries({ ...params, page: page > 1 ? String(page) : undefined }).forEach(
    ([key, value]) => {
      if (value) query.set(key, value);
    }
  );
  const search = query.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function PaginationControls({
  pathname,
  params = {},
  page,
  totalPages,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  const previousHref = pageHref(pathname, params, page - 1);
  const nextHref = pageHref(pathname, params, page + 1);

  return (
    <nav className="flex items-center justify-between gap-3 pt-3" aria-label="Pagination">
      {page > 1 ? (
        <NavigationLink
          href={previousHref}
          pendingIndicator
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-100"
          aria-label="Halaman sebelumnya"
          title="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </NavigationLink>
      ) : (
        <span className="h-9 w-9" aria-hidden="true" />
      )}
      <span className="text-xs font-medium text-surface-500" aria-live="polite">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <NavigationLink
          href={nextHref}
          pendingIndicator
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-100"
          aria-label="Halaman berikutnya"
          title="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </NavigationLink>
      ) : (
        <span className="h-9 w-9" aria-hidden="true" />
      )}
    </nav>
  );
}
