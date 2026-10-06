import writeExcelFile, { type SheetData } from 'write-excel-file/node';
import type { LeaderboardIndicatorScore } from '@/lib/leaderboard/indicator-scores';

export interface LeaderboardExcelRow {
  name: string;
  outlet_name: string;
  indicator_scores: LeaderboardIndicatorScore[];
}

const indicatorColumns = [
  {
    key: 'accuracy',
    header: 'Akurasi & Ketelitian',
    names: ['Akurasi & Ketelitian', 'Akurasi Ketelitian'],
  },
  { key: 'discipline', header: 'Kedisiplinan', names: ['Kedisiplinan', 'Disiplin'] },
  {
    key: 'sop',
    header: 'Kepatuhan SOP',
    names: ['Kepatuhan SOP', 'Kepatuhan terhadap SOP'],
  },
  {
    key: 'service',
    header: 'Pelayanan & Upselling',
    names: ['Pelayanan & Upselling', 'Pelayanan Upselling'],
  },
] as const;

function normalizeIndicatorName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id-ID')
    .replace(/&/g, ' dan ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function indicatorPercent(indicators: LeaderboardIndicatorScore[], names: readonly string[]) {
  const scores = new Map(indicators.map((item) => [normalizeIndicatorName(item.name), item.score]));
  for (const name of names) {
    const score = scores.get(normalizeIndicatorName(name));
    if (score !== undefined && Number.isFinite(score)) {
      return Math.max(0, Math.min(100, score)) / 100;
    }
  }
  return null;
}

export function createLeaderboardWorkbook(
  rows: LeaderboardExcelRow[],
  options: { indicatorReferencePeriod?: string } = {}
) {
  const reference = options.indicatorReferencePeriod
    ?.replace(/[\[\]:*?\/\\]/g, ' ')
    .replace(/\p{Cc}/gu, '')
    .trim();
  const sheet = options.indicatorReferencePeriod
    ? `Ref ${(reference || 'terpilih').slice(0, 27)}`.replace(/'+$/, '').trimEnd()
    : 'Peringkat';
  const data: SheetData = [
    ['Nama', 'Nama Outlet', ...indicatorColumns.map(({ header }) => header)].map((value) => ({
      value,
      fontWeight: 'bold',
    })),
  ];

  for (const row of rows) {
    data.push([
      { value: row.name, type: String },
      { value: row.outlet_name, type: String },
      ...indicatorColumns.map(({ names }) => {
        const percent = indicatorPercent(row.indicator_scores, names);
        return percent === null ? null : { value: percent, type: Number, format: '0.00%' };
      }),
    ]);
  }

  return writeExcelFile(data, {
    sheet,
    columns: [{ width: 30 }, { width: 28 }, ...indicatorColumns.map(() => ({ width: 25 }))],
    stickyRowsCount: 1,
  });
}
