'use client';

import Link, { useLinkStatus } from 'next/link';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type NavigationLinkProps = ComponentProps<typeof Link> & {
  pendingIndicator?: boolean;
};

function PendingIndicator() {
  const { pending } = useLinkStatus();

  return (
    <span
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary-500 opacity-0 transition-opacity delay-100 duration-150',
        pending && 'animate-pulse opacity-100'
      )}
    />
  );
}

export function NavigationLink({
  pendingIndicator = false,
  className,
  children,
  ...props
}: NavigationLinkProps) {
  return (
    <Link {...props} className={cn('relative active:opacity-80', className)}>
      {children}
      {pendingIndicator && <PendingIndicator />}
    </Link>
  );
}
