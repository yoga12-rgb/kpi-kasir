import { CheckCircle2, CircleAlert, Info, X, type LucideIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const focusableSelector =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/* ---------- Bottom Sheet ---------- */
export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const dragStartYRef = useRef<number | null>(null);
  const dragYRef = useRef(0);
  const [dragY, setDragY] = useState(0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(focusableSelector);
    const initialFocus = dialog?.querySelector<HTMLElement>('[data-autofocus]') ?? focusable?.[0];
    initialFocus?.focus();

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'contain';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;

      const currentFocusable = dialog.querySelectorAll<HTMLElement>(focusableSelector);
      if (currentFocusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = currentFocusable[0];
      const last = currentFocusable[currentFocusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [open]);

  const closeThreshold = 100;

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const sheet = dialogRef.current;
    if (!sheet || sheet.scrollTop > 0) {
      dragStartYRef.current = null;
      return;
    }
    dragStartYRef.current = event.touches[0].clientY;
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    if (dragStartYRef.current === null) return;
    const delta = event.touches[0].clientY - dragStartYRef.current;
    dragYRef.current = delta > 0 ? delta : 0;
    setDragY(dragYRef.current);
  }

  function handleTouchEnd() {
    if (dragStartYRef.current !== null && dragYRef.current >= closeThreshold) {
      onClose();
    }
    dragStartYRef.current = null;
    dragYRef.current = 0;
    setDragY(0);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex touch-none items-end justify-center bg-black/50 md:items-center md:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragY > 0 ? `translateY(${dragY}px)` : 'translateY(0)',
          transition: dragY > 0 ? 'none' : 'transform 180ms ease-out',
        }}
        className="max-h-[85vh] w-full max-w-app touch-pan-y overflow-y-auto rounded-t-2xl bg-white p-5 shadow-sheet md:max-w-lg md:rounded-2xl md:shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-surface-300 md:hidden" />
        {title && (
          <h2 id={titleId} className="mb-4 text-lg font-semibold text-surface-900">
            {title}
          </h2>
        )}
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
  const exitTimeoutRef = useRef<number | null>(null);

  const beginExit = useCallback(() => {
    if (exitTimeoutRef.current !== null) window.clearTimeout(exitTimeoutRef.current);
    setPhase('exiting');
    exitTimeoutRef.current = window.setTimeout(() => {
      exitTimeoutRef.current = null;
      onClose?.();
    }, 160);
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      setPhase('hidden');
      return;
    }

    setPhase('visible');

    const closeTimeoutId = window.setTimeout(beginExit, Math.max(0, duration));

    return () => {
      window.clearTimeout(closeTimeoutId);
      if (exitTimeoutRef.current !== null) {
        window.clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
    };
  }, [beginExit, duration, message, open, variant]);

  if (!open || phase === 'hidden') return null;

  const Icon = toastIcons[variant];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[4.25rem] z-[60] mx-auto flex max-w-app justify-center px-4">
      <div
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-medium shadow-xl shadow-black/20',
          toastStyles[variant],
          phase === 'exiting' ? 'toast-exit' : 'toast-enter'
        )}
        role={variant === 'error' ? 'alert' : 'status'}
        aria-live={variant === 'error' ? 'assertive' : 'polite'}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={beginExit}
            className="ml-1 shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
            aria-label="Tutup notifikasi"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
