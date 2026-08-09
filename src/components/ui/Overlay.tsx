import { CheckCircle2, CircleAlert, Info, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/* ---------- Bottom Sheet ---------- */
export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-app overflow-y-auto rounded-t-2xl bg-white p-5 shadow-sheet"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface-300" />
        {title && <h2 className="mb-4 text-lg font-semibold text-surface-900">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */
export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  open: boolean;
  message: string;
  variant?: ToastVariant;
  onClose?: () => void;
  duration?: number;
}

const toastStyles: Record<ToastVariant, string> = {
  success: 'border-success-500/60 bg-surface-100 text-success-500',
  error: 'border-danger-500/60 bg-surface-100 text-danger-500',
  info: 'border-primary-500/60 bg-surface-100 text-primary-700',
};

const toastIcons: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: CircleAlert,
  info: Info,
};

export function Toast({ open, message, variant = 'info', onClose, duration = 3500 }: ToastProps) {
  const [phase, setPhase] = useState<'hidden' | 'visible' | 'exiting'>('hidden');

  useEffect(() => {
    if (!open) {
      setPhase('hidden');
      return;
    }

    const exitDuration = 160;
    let exitTimeoutId: number | undefined;
    setPhase('visible');

    const closeTimeoutId = window.setTimeout(() => {
      setPhase('exiting');
      exitTimeoutId = window.setTimeout(() => {
        onClose?.();
      }, exitDuration);
    }, duration);

    return () => {
      window.clearTimeout(closeTimeoutId);
      if (exitTimeoutId) window.clearTimeout(exitTimeoutId);
    };
  }, [duration, message, onClose, open, variant]);

  if (!open || phase === 'hidden') return null;

  const Icon = toastIcons[variant];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-[60] mx-auto flex max-w-app justify-center px-4">
      <div
        className={cn(
          'flex max-w-full items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-xl shadow-black/20',
          toastStyles[variant],
          phase === 'exiting' ? 'toast-exit' : 'toast-enter'
        )}
        role={variant === 'error' ? 'alert' : 'status'}
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{message}</span>
      </div>
    </div>
  );
}
