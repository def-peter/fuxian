import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

for (const scenario of ['short', 'long', 'oversized', 'oversized-first'] as const) {
  test(`paper tables preserve columns and content without repeating headers: ${scenario}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-paper-tables-'));
    const sourcePath = join(directory, 'tables.md');
    const outputPath = join(directory, 'tables.pdf');
    const rowCount = scenario === 'long' ? 45 : 4;
    const oversized = scenario.startsWith('oversized');
    const longCell = Array.from({ length: 180 }, (_, i) => `LINE_${i}_END`).join('<br>');
    const source = [
      '# Table pagination',
      ...Array.from({ length: 16 }, () => 'Paragraph before the table.'),
      '| Window | Exposure count | Payment orders | Reference source |',
      '| --- | --- | --- | --- |',
      ...Array.from(
        { length: rowCount },
        (_, i) =>
          `| ROW_${i}_END | 0 | 0 | ${oversized && i === (scenario === 'oversized-first' ? 0 : 1) ? longCell : 'REFERENCE_FALLBACK'} |`,
      ),
      '',
      'TABLE_TERMINAL',
    ]
      .join('\n\n')
      .replace(/\|\n\n\|/g, '|\n|');
    await writeFile(sourcePath, source);
    const app = await electron.launch({
      executablePath: createRequire(import.meta.url)('electron') as string,
      args: [resolve('apps/desktop')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
        FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
        FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
        FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      },
    });
    try {
      const window = await app.firstWindow();
      await window.getByRole('button', { name: '打开 Markdown' }).click();
      await window.getByRole('radio', { name: '纸张预览' }).click();
      await expect(window.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 30_000 });
      const paper = window.frameLocator('iframe[title="纸张预览"]');
      await expect(paper.getByRole('columnheader', { name: 'Exposure count' })).toHaveCount(1);
      await expect(paper.locator('[data-paper-table-fallback]')).toHaveCount(0);
      const geometry = await paper.locator('.pagedjs_pages').evaluate((root) => {
        const header = [...root.querySelectorAll('th')].find((e) => e.textContent === 'Window')!;
        const firstRow = [...root.querySelectorAll('td')].find(
          (e) => e.textContent === 'ROW_0_END',
        )!;
        const rows = [...root.querySelectorAll('tr')];
        return {
          headerPage: header.closest('.pagedjs_page')?.getAttribute('data-page-number'),
          firstRowPage: firstRow.closest('.pagedjs_page')?.getAttribute('data-page-number'),
          rows: rows.map((row) => {
            const page = row.closest('.pagedjs_page_content')!.getBoundingClientRect();
            const bounds = row.getBoundingClientRect();
            return {
              top: bounds.top - page.top,
              bottom: bounds.bottom - page.bottom,
              widths: [...row.cells].map((cell) => cell.getBoundingClientRect().width),
            };
          }),
        };
      });
      expect(geometry.headerPage).toBe(geometry.firstRowPage);
      for (const row of geometry.rows) {
        expect(row.top).toBeGreaterThanOrEqual(-1);
        expect(row.bottom).toBeLessThanOrEqual(1);
        expect(row.widths).toHaveLength(4);
        row.widths.forEach((width, i) =>
          expect(width).toBeCloseTo(geometry.rows[0]!.widths[i]!, 0),
        );
      }
      const text = await paper.locator('.pagedjs_pages').innerText();
      for (let i = 0; i < rowCount; i++) expect(text.split(`ROW_${i}_END`)).toHaveLength(2);
      if (oversized) {
        for (let i = 0; i < 180; i++) expect(text.split(`LINE_${i}_END`)).toHaveLength(2);
      }
      const pageCount = await paper.locator('.pagedjs_page').count();
      await window.getByRole('button', { name: '导出 PDF' }).click();
      await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 30_000 });
      const loading = getDocument({ data: new Uint8Array(await readFile(outputPath)) });
      try {
        const pdf = await loading.promise;
        expect(pdf.numPages).toBe(pageCount);
        const pages = await Promise.all(
          Array.from({ length: pdf.numPages }, async (_, i) => {
            const page = await pdf.getPage(i + 1);
            const content = await page.getTextContent();
            return content.items.map((item) => ('str' in item ? item.str : '')).join('');
          }),
        );
        const pdfText = pages.join('');
        expect(pdfText.split('Exposure count')).toHaveLength(2);
        expect(pdfText).toContain('TABLE_TERMINAL');
        for (let i = 0; i < rowCount; i++) expect(pdfText.split(`ROW_${i}_END`)).toHaveLength(2);
        if (oversized) {
          for (let i = 0; i < 180; i++) expect(pdfText.split(`LINE_${i}_END`)).toHaveLength(2);
        }
        await test
          .info()
          .attach('tables.pdf', { path: outputPath, contentType: 'application/pdf' });
      } finally {
        await loading.destroy();
      }
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
