import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  addMonths,
  addYears,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  format,
  isAfter,
  isValid,
  parseISO,
} from 'date-fns';
import { id } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'dd MMM yyyy', { locale: id });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  return format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: id });
}

export function formatEmploymentDuration(
  startDate: string | null | undefined,
  endDate: Date = new Date()
): string {
  if (!startDate) return '-';

  const start = parseISO(startDate);
  if (!isValid(start) || !isValid(endDate) || isAfter(start, endDate)) return '-';

  const years = differenceInYears(endDate, start);
  const afterYears = addYears(start, years);
  const months = differenceInMonths(endDate, afterYears);
  const afterMonths = addMonths(afterYears, months);
  const days = differenceInDays(endDate, afterMonths);
  const parts: string[] = [];

  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (days > 0 || parts.length === 0) parts.push(`${days} hari`);

  return parts.slice(0, 2).join(' ');
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toFixed(2);
}

export function formatWeight(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Terjadi kesalahan yang tidak diketahui';
}

export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export function monthlyLabel(date: Date): string {
  return format(date, 'yyyy-MM');
}

export function periodStartDate(date: Date): string {
  return format(date, 'yyyy-MM-01');
}

export function periodEndDate(date: Date): string {
  return format(new Date(date.getFullYear(), date.getMonth() + 1, 0), 'yyyy-MM-dd');
}
