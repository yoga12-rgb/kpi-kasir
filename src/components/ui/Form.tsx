import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

function describedBy(
  supplied: string | undefined,
  error: string | undefined,
  errorId: string
) {
  return [supplied, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? `input-${generatedId}`;
    const errorId = `${inputId}-error`;

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="label">
            {label}
          </label>
        )}
        <input
          {...props}
          id={inputId}
          ref={ref}
          className={cn('input', error && 'border-danger-500', className)}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy(props['aria-describedby'], error, errorId)}
        />
        {error && (
          <p id={errorId} className="mt-1 text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? `textarea-${generatedId}`;
    const errorId = `${textareaId}-error`;

    return (
      <div>
        {label && (
          <label htmlFor={textareaId} className="label">
            {label}
          </label>
        )}
        <textarea
          {...props}
          id={textareaId}
          ref={ref}
          className={cn('input min-h-[80px]', error && 'border-danger-500', className)}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy(props['aria-describedby'], error, errorId)}
        />
        {error && (
          <p id={errorId} className="mt-1 text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? `select-${generatedId}`;
    const errorId = `${selectId}-error`;

    return (
      <div>
        {label && (
          <label htmlFor={selectId} className="label">
            {label}
          </label>
        )}
        <select
          {...props}
          id={selectId}
          ref={ref}
          className={cn('input', error && 'border-danger-500', className)}
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={describedBy(props['aria-describedby'], error, errorId)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={errorId} className="mt-1 text-xs text-danger-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
