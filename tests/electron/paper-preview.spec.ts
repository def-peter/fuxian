import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('paper mode preserves finished-document behavior and matches exported PDF pages', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-paper-preview-'));
  const sourcePath = join(directory, 'paper-preview.md');
  const outputPath = join(directory, 'paper-preview.pdf');
  const tableRows = Array.from(
    { length: 32 },
    (_, index) => `| ${index + 1} | 第 ${index + 1} 行保留可选择的表格文字 |`,
  );
  await writeFile(
    sourcePath,
    [
      '# 纸张预览验收',
      '',
      ...Array.from({ length: 24 }, (_, index) =>
        `第 ${index + 1} 段用于形成稳定的多页正文。`.repeat(4),
      ),
      '',
      '## 长表格',
      '',
      '| 序号 | 说明 |',
      '| ---: | --- |',
      ...tableRows,
      '',
      '## 可交互图表',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[纸张快照] --> B[统一分页] --> C[PDF]',
      '```',
      '',
      '## 末尾验收',
      '',
      'FUXIAN_PAPER_TERMINAL_MARKER',
    ].join('\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const continuous = window.frameLocator('iframe[title="Finished document"]');
    await expect(
      continuous.locator('[data-render-task-kind="mermaid"] .render-task-output svg'),
    ).toBeVisible({ timeout: 15_000 });

    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    const pages = paper.locator('.pagedjs_page');
    await expect(window.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 20_000 });
    const screenPageCount = await pages.count();
    expect(screenPageCount).toBeGreaterThan(2);
    const fitScale = await paper.locator('html').evaluate((element) => ({
      innerHeight,
      innerWidth,
      value: Number.parseFloat(getComputedStyle(element).getPropertyValue('--paper-preview-scale')),
    }));
    expect(fitScale.value).toBeCloseTo(
      Math.min(
        1,
        Math.max(1, fitScale.innerWidth - 40) / ((210 / 25.4) * 96),
        Math.max(1, fitScale.innerHeight - 40) / ((297 / 25.4) * 96),
      ),
      5,
    );
    await expect(window.getByRole('radio', { name: '实际大小' })).toHaveCount(0);
    await expect(window.getByRole('radio', { name: '适合宽度' })).toHaveCount(0);
    expect(await pages.count()).toBe(screenPageCount);
    expect(
      await pages.locator('table').evaluateAll((tables) =>
        tables
          .map((table) => ({
            headerRows: table.querySelectorAll('thead tr').length,
            rows: table.querySelectorAll('tbody tr').length,
          }))
          .filter(({ rows }) => rows > 0),
      ),
    ).toEqual([
      { headerRows: 1, rows: 8 },
      { headerRows: 1, rows: 8 },
      { headerRows: 1, rows: 8 },
      { headerRows: 1, rows: 8 },
    ]);

    const terminalMarker = paper.getByText('FUXIAN_PAPER_TERMINAL_MARKER');
    await expect(terminalMarker).toHaveCount(1);
    expect(
      await terminalMarker.evaluate((element) => {
        const selection = getSelection();
        const range = document.createRange();
        range.selectNodeContents(element);
        selection?.removeAllRanges();
        selection?.addRange(range);
        const text = selection?.toString() ?? '';
        selection?.removeAllRanges();
        return text;
      }),
    ).toBe('FUXIAN_PAPER_TERMINAL_MARKER');

    const paperDiagram = paper.locator(
      '.pagedjs_page [data-render-task-kind="mermaid"] .render-task-output svg:visible',
    );
    expect(
      await paperDiagram.evaluateAll(
        (svgs) =>
          svgs.filter((svg) => {
            const box = svg.getBoundingClientRect();
            const page = svg.closest('.pagedjs_page_content')?.getBoundingClientRect();
            return page && box.bottom > page.top && box.top < page.bottom;
          }).length,
      ),
    ).toBe(1);
    const sourceButton = paper.getByRole('button', { name: '查看图表源码' });
    await sourceButton.hover();
    await sourceButton.click();
    await expect(window.getByLabel('Mermaid 图表源码')).toContainText('统一分页');
    await window.getByRole('button', { name: '关闭图表源码' }).click();

    await window.getByRole('button', { name: '页内查找' }).click();
    await window.getByRole('textbox', { name: '页内查找' }).fill('FUXIAN_PAPER_TERMINAL_MARKER');
    await expect(window.getByText('1/1', { exact: true })).toBeVisible();
    await window.getByRole('button', { name: '关闭查找' }).click();

    const terminalOutlineItem = window.getByRole('button', { name: '末尾验收', exact: true });
    await terminalOutlineItem.click();
    await expect(terminalOutlineItem).toHaveAttribute('aria-current', 'location');

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    const data = new Uint8Array(await readFile(outputPath));
    const pdf = await getDocument({ data, disableFontFace: true }).promise;
    expect(pdf.numPages).toBe(screenPageCount);
    const terminalPage = await pdf.getPage(pdf.numPages);
    const text = await terminalPage.getTextContent();
    expect(text.items.map((item) => ('str' in item ? item.str : '')).join(' ')).toContain(
      'FUXIAN_PAPER_TERMINAL_MARKER',
    );
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('paper mode scrolls with the mouse wheel', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-paper-scroll-'));
  const sourcePath = join(directory, 'paper-scroll.md');
  await writeFile(
    sourcePath,
    [
      '# 纸张滚动验收',
      ...Array.from({ length: 80 }, (_, index) => `第 ${index + 1} 段多页正文。`.repeat(8)),
    ].join('\n\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    const pages = paper.locator(
      '.paper-preview-pages:not(.paper-pagination-staging) .pagedjs_page',
    );
    await expect.poll(() => pages.count(), { timeout: 20_000 }).toBeGreaterThan(2);
    const frameBackground = await window
      .locator('iframe[title="纸张预览"]')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    const paperGeometry = await pages.evaluateAll((elements) => {
      const first = elements[0]?.getBoundingClientRect();
      const second = elements[1]?.getBoundingClientRect();
      const pageContainer = elements[0]?.parentElement;
      const previewPages = pageContainer?.parentElement;
      const viewport = previewPages?.parentElement;
      return {
        background: first ? getComputedStyle(elements[0]!).backgroundColor : '',
        gap: first && second ? second.top - first.bottom : 0,
        height: first?.height ?? 0,
        leftGutter: first?.left ?? 0,
        outerBackground: getComputedStyle(document.body).backgroundColor,
        pageShadow: first ? getComputedStyle(elements[0]!).boxShadow : '',
        pageContainerBackground: pageContainer
          ? getComputedStyle(pageContainer).backgroundColor
          : '',
        previewPagesBackground: previewPages ? getComputedStyle(previewPages).backgroundColor : '',
        rightGutter: first ? document.documentElement.clientWidth - first.right : 0,
        viewportBackground: viewport ? getComputedStyle(viewport).backgroundColor : '',
        viewportHeight: innerHeight,
        width: first?.width ?? 0,
      };
    });
    expect(paperGeometry.height).toBeGreaterThan(paperGeometry.width);
    expect(paperGeometry.height).toBeLessThanOrEqual(paperGeometry.viewportHeight - 40 + 1);
    expect(paperGeometry.width / paperGeometry.height).toBeCloseTo(210 / 297, 2);
    expect(paperGeometry.gap).toBeGreaterThan(8);
    expect(paperGeometry.leftGutter).toBeCloseTo(paperGeometry.rightGutter, 0);
    expect(paperGeometry.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(paperGeometry.pageShadow).not.toBe('none');
    expect(frameBackground).toBe('rgba(0, 0, 0, 0)');
    expect(paperGeometry.outerBackground).toBe('rgba(0, 0, 0, 0)');
    expect(paperGeometry.pageContainerBackground).toBe('rgba(0, 0, 0, 0)');
    expect(paperGeometry.previewPagesBackground).toBe('rgba(0, 0, 0, 0)');
    expect(paperGeometry.viewportBackground).toBe('rgba(0, 0, 0, 0)');
    await pages.first().hover();
    const scrollTopBeforeWheel = await paper
      .locator('html')
      .evaluate(() => document.scrollingElement?.scrollTop ?? 0);
    await window.mouse.wheel(0, 800);
    await expect
      .poll(() => paper.locator('html').evaluate(() => document.scrollingElement?.scrollTop ?? 0), {
        timeout: 2_000,
      })
      .toBeGreaterThan(scrollTopBeforeWheel);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('paper mode discards an obsolete pagination snapshot', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-paper-revision-'));
  const sourcePath = join(directory, 'paper-revision.md');
  await writeFile(sourcePath, '# Initial paper revision\n\nInitial content.');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    await expect(paper.getByRole('heading', { name: 'Initial paper revision' })).toBeVisible({
      timeout: 20_000,
    });
    const sendSnapshot = async (revisionId: string, html: string): Promise<void> => {
      await window.locator('iframe[title="纸张预览"]').evaluate(
        (element, snapshot) => {
          const iframe = element as HTMLIFrameElement;
          const channelId = new URL(iframe.src).searchParams.get('channelId');
          iframe.contentWindow?.postMessage(
            {
              channelId,
              scope: 'fuxian-paper-preview',
              snapshot,
              type: 'render',
            },
            '*',
          );
        },
        {
          html,
          initialReadingPosition: { headingOffset: 0, relativeProgress: 0 },
          preferences: {
            appearance: 'light' as const,
            bodyFamily: 'serif' as const,
            bodySize: 17,
            customWidth: 860,
            lineHeight: 1.85,
            widthMode: 'adaptive' as const,
          },
          revisionId,
        },
      );
    };

    await sendSnapshot(
      'obsolete-large-revision',
      [
        '<h1 id="obsolete">Obsolete large paper revision</h1>',
        ...Array.from(
          { length: 8_000 },
          (_, index) => `<p>OBSOLETE_PAPER_MARKER paragraph ${index + 1}.</p>`,
        ),
      ].join(''),
    );
    await expect(paper.getByText('正在更新分页...')).toBeVisible({ timeout: 20_000 });
    await sendSnapshot(
      'newest-short-revision',
      '<h1 id="newest">Newest paper revision</h1><p>NEWEST_PAPER_MARKER must remain visible.</p>',
    );

    await expect(paper.getByRole('heading', { name: 'Newest paper revision' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(paper.getByText('NEWEST_PAPER_MARKER must remain visible.')).toBeVisible();
    await window.waitForTimeout(1_000);
    await expect(paper.getByText('OBSOLETE_PAPER_MARKER', { exact: false })).toHaveCount(0);
    await expect(paper.locator('.pagedjs_page')).toHaveCount(1);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('paper mode keeps multiple tall rendered visuals inside their A4 pages', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-paper-visual-layout-'));
  const sourcePath = join(directory, 'paper-visual-layout.md');
  await writeFile(sourcePath, '# Initial visual layout\n\nInitial content.');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    await expect(paper.getByRole('heading', { name: 'Initial visual layout' })).toBeVisible({
      timeout: 20_000,
    });

    const dimensions = [
      [700, 300],
      [700, 130],
      [700, 510],
      [700, 510],
      [510, 600],
      [700, 470],
      [440, 590],
      [700, 335],
      [270, 600],
    ] as const;
    const table = `<table><thead><tr><th>符号</th><th>说明</th><th>来源</th></tr></thead><tbody>${Array.from(
      { length: 12 },
      (_, index) =>
        `<tr><td>${index + 1}</td><td>用于形成真实分页边界的表格内容</td><td>测试</td></tr>`,
    ).join('')}</tbody></table>`;
    const html = [
      '<h1 id="visual-layout">多图表纸张布局</h1>',
      ...Array.from({ length: 8 }, (_, index) => `<p>开篇正文第 ${index + 1} 段。</p>`),
      table,
      ...dimensions.flatMap(([width, height], index) => [
        `<h2 id="visual-${index + 1}">图表 ${index + 1}</h2>`,
        ...Array.from(
          { length: 3 + (index % 4) },
          (_, paragraph) =>
            `<p>图表 ${index + 1} 前的正文 ${paragraph + 1}，用于改变剩余页高。</p>`,
        ),
        index === 3 || index === 6 ? table : '',
        `<figure aria-label="PlantUML 图表" class="render-task diagram-render-task" data-render-state="succeeded" data-render-task-id="paper-visual-${index + 1}" data-render-task-kind="plantuml"><code class="render-task-source" hidden>@startuml\nAlice -> Bob: ${index + 1}\n@enduml</code><div class="render-task-output"><svg height="${height}" viewBox="0 0 ${width} ${height}" width="${width}" xmlns="http://www.w3.org/2000/svg"><rect fill="#edf5f2" height="${height - 2}" stroke="#61706b" width="${width - 2}" x="1" y="1"/><text font-size="28" x="40" y="70">PAPER_VISUAL_${index + 1}</text></svg></div><span class="render-task-error" hidden></span></figure>`,
      ]),
      '<h2 id="terminal">末尾验收</h2><p>PAPER_VISUAL_TERMINAL_MARKER</p>',
    ].join('');

    await window.locator('iframe[title="纸张预览"]').evaluate(
      (element, snapshot) => {
        const iframe = element as HTMLIFrameElement;
        const channelId = new URL(iframe.src).searchParams.get('channelId');
        iframe.contentWindow?.postMessage(
          { channelId, scope: 'fuxian-paper-preview', snapshot, type: 'render' },
          '*',
        );
      },
      {
        html,
        initialReadingPosition: { headingOffset: 0, relativeProgress: 0 },
        preferences: {
          appearance: 'light' as const,
          bodyFamily: 'serif' as const,
          bodySize: 17,
          customWidth: 860,
          lineHeight: 1.85,
          widthMode: 'adaptive' as const,
        },
        revisionId: 'multi-visual-layout',
      },
    );

    const committedPages = paper.locator('.paper-preview-pages:not(.paper-pagination-staging)');
    await expect(committedPages.getByText('PAPER_VISUAL_TERMINAL_MARKER')).toBeVisible({
      timeout: 30_000,
    });
    const visuals = paper.locator(
      '.paper-preview-pages:not(.paper-pagination-staging) [data-render-task-kind="plantuml"] .render-task-output > svg',
    );
    await expect(visuals).toHaveCount(dimensions.length);
    expect(
      await visuals.evaluateAll((svgs) =>
        svgs.map((svg) => {
          const page = svg.closest('.pagedjs_page');
          if (!page) return false;
          const bounds = svg.getBoundingClientRect();
          const pageBounds = page.getBoundingClientRect();
          return (
            bounds.left >= pageBounds.left - 1 &&
            bounds.right <= pageBounds.right + 1 &&
            bounds.top >= pageBounds.top - 1 &&
            bounds.bottom <= pageBounds.bottom + 1
          );
        }),
      ),
    ).toEqual(dimensions.map(() => true));
    await expect(
      paper.locator(
        '.paper-preview-pages:not(.paper-pagination-staging) [data-render-task-id^="paper-visual-"]',
      ),
    ).toHaveCount(dimensions.length);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
