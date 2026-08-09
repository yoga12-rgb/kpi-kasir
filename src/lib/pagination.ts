export const DEFAULT_PAGE_SIZE = 25;

export function parsePage(value: string | null | undefined, max = 10000) {
  const page = Number(value ?? '1');
  if (!Number.isInteger(page) || page < 1) return 1;
  return Math.min(page, max);
}

export function getPageRange(page: number, pageSize = DEFAULT_PAGE_SIZE) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function getTotalPages(count: number | null | undefined, pageSize = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil((count ?? 0) / pageSize));
}

export function escapeIlike(value: string) {
  return value.trim().replace(/[\\%_]/g, (character) => `\\${character}`);
}
