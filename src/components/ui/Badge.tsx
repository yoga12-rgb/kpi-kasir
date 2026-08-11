import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-100 text-surface-700',
  success: 'bg-success-500/10 text-success-600',
  warning: 'bg-warning-500/10 text-warning-600',
  danger: 'bg-danger-500/10 text-danger-600',
  info: 'bg-primary-500/10 text-primary-700',
  muted: 'bg-surface-200 text-surface-500',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return <span className={cn('chip', variants[variant], className)} {...props} />;
}
