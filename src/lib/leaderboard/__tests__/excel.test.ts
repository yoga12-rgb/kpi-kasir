import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createLeaderboardWorkbook } from '@/lib/leaderboard/excel';

function cellXml(sheet: string, address: string) {
  return sheet.match(new RegExp(`<c\\b[^>]*\\br="${address}"[^>]*(?:\\/>|>.*?<\\/c>)`))?.[0];
}

describe('createLeaderboardWorkbook', () => {
  it('writes six columns with real Excel percentages, blank missing scores, and safe text cells', async () => {
    const workbook = createLeaderboardWorkbook(
      [
        {
          name: 'Siti',
          outlet_name: 'Outlet Pusat',
          indicator_scores: [
            { id: 'a', name: 'Akurasi & Ketelitian', score: 87.5 },
            { id: 'b', name: 'Kedisiplinan', score: 0 },
            { id: 'c', name: 'Kepatuhan SOP', score: 93.25 },
            { id: 'd', name: 'Pelayanan & Upselling', score: 76 },
          ],
        },
        {
          name: 'Budi',
          outlet_name: 'Outlet Barat',
          indicator_scores: [
            { id: 'e', name: 'akurasi DAN ketelitian', score: 90 },
            { id: 'f', name: 'Akurasi Transaksi', score: 20 },
            { id: 'g', name: 'Pelayanan', score: 99 },
          ],
        },
        { name: '=1+1', outlet_name: '=2+2', indicator_scores: [] },
      ],
      { indicatorReferencePeriod: '2026-10' }
    );

    const bytes = await workbook.toBuffer();
    expect(bytes.subarray(0, 2).toString()).toBe('PK');

    const files = unzipSync(bytes);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']);
    const sharedStrings = strFromU8(files['xl/sharedStrings.xml']);
    const styles = strFromU8(files['xl/styles.xml']);
    const workbookXml = strFromU8(files['xl/workbook.xml']);

    const headerRow = sheet.match(/<row r="1">(.*?)<\/row>/)?.[1] ?? '';
    expect([...headerRow.matchAll(/<c r="([A-Z]+1)"/g)].map((match) => match[1])).toEqual([
      'A1',
      'B1',
      'C1',
      'D1',
      'E1',
      'F1',
    ]);
    expect(
      [...sharedStrings.matchAll(/<si><t>(.*?)<\/t><\/si>/g)].slice(0, 6).map((match) => match[1])
    ).toEqual([
      'Nama',
      'Nama Outlet',
      'Akurasi &amp; Ketelitian',
      'Kedisiplinan',
      'Kepatuhan SOP',
      'Pelayanan &amp; Upselling',
    ]);

    const percentFormatId = styles.match(/<numFmt numFmtId="(\d+)" formatCode="0\.00%"\/>/)?.[1];
    expect(percentFormatId).toBeDefined();
    const xfs = styles.match(/<cellXfs[^>]*>(.*?)<\/cellXfs>/)?.[1] ?? '';
    const percentStyleIndex = [...xfs.matchAll(/<xf\b[^>]*>/g)].findIndex((match) =>
      match[0].includes(`numFmtId="${percentFormatId}"`)
    );
    expect(percentStyleIndex).toBeGreaterThanOrEqual(0);

    for (const [address, value] of [
      ['C2', '0.875'],
      ['D2', '0'],
      ['E2', '0.9325'],
      ['F2', '0.76'],
      ['C3', '0.9'],
    ]) {
      const cell = cellXml(sheet, address);
      expect(cell).toContain(`s="${percentStyleIndex}"`);
      expect(cell).toContain(`<v>${value}</v>`);
    }
    for (const address of ['D3', 'E3', 'F3']) {
      expect(cellXml(sheet, address)).toBeUndefined();
    }

    expect(sheet).toContain('ySplit="1"');
    expect(workbookXml).toContain('name="Ref 2026-10"');
    expect(cellXml(sheet, 'A4')).toContain('t="s"');
    expect(cellXml(sheet, 'B4')).toContain('t="s"');
    expect(sharedStrings).toContain('<t>=1+1</t>');
    expect(sharedStrings).toContain('<t>=2+2</t>');
    expect(sheet).not.toContain('<f>');
  });

  it('keeps the cumulative reference visible in a valid worksheet tab name', async () => {
    const bytes = await createLeaderboardWorkbook([], {
      indicatorReferencePeriod: '2026/10:*?[] sangat panjang sekali',
    }).toBuffer();
    const files = unzipSync(bytes);
    const workbookXml = strFromU8(files['xl/workbook.xml']);
    const sheetName = workbookXml.match(/<sheet\b[^>]*name="([^"]+)"/)?.[1];

    expect(sheetName).toMatch(/^Ref 2026 10/);
    expect(sheetName?.length).toBeLessThanOrEqual(31);
    expect(sheetName).not.toMatch(/[\[\]:*?\/\\]/);
  });
});
