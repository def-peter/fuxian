import { parseHTML } from 'linkedom';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../localization';
import {
  applyPaperTheme,
  paperPagedMediaCss,
  paperPageMarginBlockMillimeters,
  paperPageMarginInlineMillimeters,
  splitLongTables,
} from './paper-pagination';

const createTable = (rowCount: number): string => `
  <main>
    <table>
      <thead><tr><th>序号</th><th>说明</th></tr></thead>
      <tbody>
        ${Array.from(
          { length: rowCount },
          (_, index) => `<tr><td>${index + 1}</td><td>内容 ${index + 1}</td></tr>`,
        ).join('')}
      </tbody>
    </table>
  </main>
`;

describe('paper table preparation', () => {
  const zh = createTranslator('zh-CN');

  it('splits long Markdown tables into bounded groups with repeated headers', () => {
    const { document } = parseHTML(createTable(17));
    splitLongTables(document, zh, () => 40);

    const tables = Array.from(document.querySelectorAll('table'));
    expect(tables).toHaveLength(3);
    expect(tables.map((table) => table.querySelectorAll('tbody tr').length)).toEqual([8, 8, 1]);
    expect(tables.map((table) => table.querySelector('thead')?.textContent)).toEqual([
      '序号说明',
      '序号说明',
      '序号说明',
    ]);
    expect(document.querySelector('main')?.textContent).toContain('内容 17');
  });

  it('turns an individually over-height row into a labelled, content-preserving block', () => {
    const { document } = parseHTML(createTable(3));
    splitLongTables(document, zh, (row) => (row.textContent?.includes('内容 2') ? 900 : 40));

    const fallback = document.querySelector('[data-paper-table-fallback="true"]');
    expect(fallback?.textContent).toContain('单行超过一页');
    expect(fallback?.textContent).toContain('序号2');
    expect(fallback?.textContent).toContain('说明内容 2');
    expect(document.querySelectorAll('table')).toHaveLength(2);
    expect(document.querySelector('main')?.textContent).toContain('内容 3');
  });

  it('localizes application-generated fallback labels without changing table content', () => {
    const { document } = parseHTML(`
      <main><table><tbody><tr><td>作者内容</td></tr></tbody></table></main>
    `);
    splitLongTables(document, createTranslator('en-US'), () => 900);

    const fallback = document.querySelector<HTMLElement>('[data-paper-table-fallback="true"]');
    expect(fallback?.ariaLabel).toBe('Oversized table content');
    expect(fallback?.textContent).toContain('Table content');
    expect(fallback?.textContent).toContain('Column 1作者内容');
  });
});

describe('paper theme', () => {
  it('uses the compact reviewed A4 page margins', () => {
    expect(paperPageMarginBlockMillimeters).toBe(14);
    expect(paperPageMarginInlineMillimeters).toBe(12);
    expect(paperPagedMediaCss).toMatch(/@page\s*\{[^}]*margin: 14mm 12mm;/s);
  });

  it('keeps the code theme independent from document appearance', () => {
    const { document } = parseHTML('<main />');

    applyPaperTheme(document, {
      appearance: 'light',
      bodyFamily: 'sans-serif',
      bodySize: 15,
      codeTheme: 'github-dark',
      customWidth: 960,
      lineHeight: 1.85,
      widthMode: 'adaptive',
    });

    expect(document.documentElement.dataset.appearance).toBe('light');
    expect(document.documentElement.dataset.codeTheme).toBe('github-dark');
  });
});
