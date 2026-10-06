export interface LeaderboardExportPage<Row> {
  rows: Row[];
  hasMore: boolean;
  nextCursor: string | null;
}

export class LeaderboardExportLimitError extends Error {}
export class LeaderboardExportPaginationError extends Error {}

export async function collectLeaderboardExportRows<Row>(
  fetchPage: (cursor: string | null) => Promise<LeaderboardExportPage<Row>>,
  maxRows: number
): Promise<Row[]> {
  const rows: Row[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  while (true) {
    const page = await fetchPage(cursor);
    if (rows.length + page.rows.length > maxRows) {
      throw new LeaderboardExportLimitError();
    }
    rows.push(...page.rows);
    if (!page.hasMore) return rows;
    if (!page.rows.length || !page.nextCursor || seenCursors.has(page.nextCursor)) {
      throw new LeaderboardExportPaginationError();
    }
    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
