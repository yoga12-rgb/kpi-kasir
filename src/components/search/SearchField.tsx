'use client';

import { Search } from 'lucide-react';
import type { FormEventHandler } from 'react';

interface SearchFieldProps {
  label: string;
  ariaLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function SearchField({
  label,
  ariaLabel,
  placeholder,
  value,
  onChange,
  onSubmit,
}: SearchFieldProps) {
  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <label className="min-w-0 flex-1 text-xs font-medium text-surface-500">
        {label}
        <input
          name="q"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={100}
          placeholder={placeholder}
          className="input mt-1"
        />
      </label>
      <button
        type="submit"
        className="btn btn-secondary h-10 w-10 px-0"
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <Search className="mx-auto h-4 w-4" />
      </button>
    </form>
  );
}
