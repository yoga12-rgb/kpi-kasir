'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ClientPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function ClientPagination({ page, totalPages, onPageChange }: ClientPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-between gap-3 pt-3" aria-label="Pagination">
      {page > 1 ? (
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-100"
          aria-label="Halaman sebelumnya"
          title="Halaman sebelumnya"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      ) : (
        <span className="h-9 w-9" aria-hidden="true" />
      )}
      <span className="text-xs font-medium text-surface-500" aria-live="polite">
        {page} / {totalPages}
      </span>
      {page < totalPages ? (
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-100"
          aria-label="Halaman berikutnya"
          title="Halaman berikutnya"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      ) : (
        <span className="h-9 w-9" aria-hidden="true" />
      )}
    </nav>
  );
}
