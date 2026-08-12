'use client';

import { usePathname, useSearchParams } from 'next/navigation';

export function useCurrentReturnTo() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = new URLSearchParams(searchParams.toString());
  params.delete('returnTo');
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
