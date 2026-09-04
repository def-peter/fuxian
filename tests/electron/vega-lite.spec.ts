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
const sourcePath = resolve(repositoryRoot, 'fixtures/vega-lite.md');

const readPdfText = async (path: string): Promise<string> => {
  const loading = getDocument({ data: new Uint8Array(await readFile(path)) });
  const pdf = await loading.promise;
  const text: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' '));
  }
  await loading.destroy();
  return text.join(' ').normalize('NFKC').replace(/\s+/gu, '');
};

const vegaBlock = (values: Array<{ category: string; value: number }>): string =>
  [
    '```vega-lite',
    JSON.stringify({
      data: { values },
      encoding: {
        x: { field: 'category', type: 'nominal' },
        y: { field: 'value', type: 'quantitative' },
      },
      mark: { color: '#0052cc', type: 'bar' },
    }),
    '```',
  ].join('\n');

test('keeps display math and Vega-Lite labels inside their rendered bounds', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-render-overflow-'));
  const overflowSourcePath = join(directory, 'render-overflow.md');
  await writeFile(
    overflowSourcePath,
    [
      '# Render overflow',
      '',
      '$$',
      String.raw`\mathrm{Completion\ Rate} = \frac{\mathrm{Completed\ Sessions}}{\mathrm{Valid\ Reading\ Sessions}} \times 100\%`,
      '$$',
      '',
      '```vega-lite',
      JSON.stringify({
        data: {
          values: [
            { avg_q: 0.732695, country: 'KE', metric: '曝光价值密度' },
            { avg_q: 0.358593, country: 'UG', metric: '曝光价值密度' },
            { avg_q: 0.697454, country: 'KE', metric: '支付订单曝光代理比率' },
            { avg_q: 0.238457, country: 'UG', metric: '支付订单曝光代理比率' },
            { avg_q: 0.713163, country: 'KE', metric: '支付用户曝光用户代理比率' },
            { avg_q: 0.206911, country: 'UG', metric: '支付用户曝光用户代理比率' },
            { avg_q: 0.590332, country: 'KE', metric: '曝光点击率' },
            { avg_q: 0.49676, country: 'UG', metric: '曝光点击率' },
            { avg_q: 0.640729, country: 'KE', metric: '独立曝光点击率' },
            { avg_q: 0.489058, country: 'UG', metric: '独立曝光点击率' },
          ],
        },
        encoding: {
          color: {
            field: 'country',
            scale: { domain: ['KE', 'UG'], range: ['#1677FF', '#FA8C16'] },
            title: '国家',
            type: 'nominal',
          },
          x: {
            axis: { labelAngle: -25, labelLimit: 150 },
            field: 'metric',
            sort: [
              '曝光价值密度',
              '支付订单曝光代理比率',
              '支付用户曝光用户代理比率',
              '曝光点击率',
              '独立曝光点击率',
            ],
            title: null,
            type: 'nominal',
          },
          xOffset: { field: 'country' },
          y: {
            field: 'avg_q',
            scale: { domain: [0, 1] },
            title: 'q 均值',
            type: 'quantitative',
          },
        },
        height: 280,
        mark: { tooltip: true, type: 'bar' },
        width: 520,
      }),
      '```',
    ].join('\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: overflowSourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[data-finished-document="active"]');
    const mathOutput = finishedDocument.locator(
      '[data-render-task-kind="math-display"] > .render-task-output',
    );
    const vegaSvg = finishedDocument.locator(
      '[data-render-task-kind="vega-lite"] > .render-task-output > svg',
    );
    await expect(mathOutput.locator('math[display="block"]')).toBeVisible();
    await expect(vegaSvg).toBeVisible();

    const mathGeometry = await mathOutput.evaluate((element) => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
    }));
    expect.soft(mathGeometry.overflowY).toBe('hidden');
    expect.soft(mathGeometry.scrollHeight).toBeLessThanOrEqual(mathGeometry.clientHeight);

    const overflowingLabels = await vegaSvg.locator('text').evaluateAll(
      (labels, svg) => {
        const svgBounds = svg.getBoundingClientRect();
        return labels.flatMap((label) => {
          const bounds = label.getBoundingClientRect();
          const overflow = {
            bottom: bounds.bottom - svgBounds.bottom,
            left: svgBounds.left - bounds.left,
            right: bounds.right - svgBounds.right,
            top: svgBounds.top - bounds.top,
          };
          return Object.values(overflow).some((amount) => amount > 0.5)
            ? [{ overflow, text: label.textContent }]
            : [];
        });
      },
      await vegaSvg.elementHandle(),
    );
    expect(overflowingLabels).toEqual([]);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('waits for a Vega-Lite snapshot when PDF export starts immediately', async () => {
  test.setTimeout(45_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-lite-export-'));
  const outputPath = join(directory, 'vega-lite.pdf');
  const immediateSourcePath = join(directory, 'immediate-export.md');
  await writeFile(
    immediateSourcePath,
    [
      '# Immediate export',
      '',
      vegaBlock([
        { category: 'Alpha', value: 12 },
        { category: 'Beta', value: 20 },
      ]),
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
      FUXIAN_E2E_SOURCE_DOCUMENT: immediateSourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('button', { name: '导出 PDF' }).click();

    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    const pdfText = await readPdfText(outputPath);
    expect(pdfText).not.toContain('可视化快照不可用');
    expect(pdfText).toContain('Alpha');
    expect(pdfText).toContain('Beta');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('keeps Vega-Lite snapshots stable across document lifecycle changes', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-lite-lifecycle-'));
  const plainSourcePath = join(directory, 'plain.md');
  const visualSourcePath = join(directory, 'visuals.md');
  const outputPath = join(directory, 'visuals.pdf');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const duplicateBlock = vegaBlock([
    { category: 'Alpha', value: 12 },
    { category: 'Beta', value: 20 },
  ]);
  const initialVisualSource = [
    '# Multi Vega export',
    '',
    duplicateBlock,
    '',
    duplicateBlock,
    '',
    vegaBlock([
      { category: 'Gamma', value: 8 },
      { category: 'Delta', value: 16 },
    ]),
  ].join('\n');
  await writeFile(plainSourcePath, '# Plain document\n\nNo visual tasks.');
  await writeFile(visualSourcePath, initialVisualSource);

  const launch = (): ReturnType<typeof electron.launch> =>
    electron.launch({
      executablePath: electronPath,
      args: [desktopAppPath],
      env: {
        ...process.env,
        FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
        FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
        FUXIAN_E2E_SESSION_FILE: sessionPath,
        FUXIAN_E2E_SOURCE_DOCUMENT: plainSourcePath,
        FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify([plainSourcePath, visualSourcePath]),
        NODE_ENV: 'test',
      },
    });

  let electronApp = await launch();
  try {
    let window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('button', { exact: true, name: 'visuals.md' }).click();
    await expect(
      window
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'Multi Vega export' }),
    ).toBeVisible();
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    const firstPdfText = await readPdfText(outputPath);
    expect(firstPdfText).not.toContain('可视化快照不可用');
    expect(firstPdfText.match(/Alpha/gu)).toHaveLength(2);
    expect(firstPdfText).toContain('Gamma');

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('正在准备文档')).toBeVisible();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    expect(await readPdfText(outputPath)).toBe(firstPdfText);

    await writeFile(
      visualSourcePath,
      [
        '# Revised Vega export',
        '',
        vegaBlock([
          { category: 'RevisedOne', value: 21 },
          { category: 'RevisedTwo', value: 34 },
        ]),
      ].join('\n'),
    );
    await expect(
      window
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'Revised Vega export' }),
    ).toBeVisible({ timeout: 15_000 });
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    expect(await readPdfText(outputPath)).toContain('RevisedOne');

    await electronApp.close();
    electronApp = await launch();
    window = await electronApp.firstWindow();
    await expect(
      window
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'Revised Vega export' }),
    ).toBeVisible({ timeout: 15_000 });
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    const restoredPdfText = await readPdfText(outputPath);
    expect(restoredPdfText).not.toContain('可视化快照不可用');
    expect(restoredPdfText).toContain('RevisedTwo');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('renders safe Vega-Lite blocks and keeps rejected sources explicit', async () => {
  test.setTimeout(45_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-lite-'));
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
    const finishedDocument = window.frameLocator('iframe[data-finished-document="active"]');
    await expect(finishedDocument.getByText('正文应当立即可读')).toBeVisible();
    const tasks = finishedDocument.locator('[data-render-task-kind="vega-lite"]');
    await expect(tasks).toHaveCount(3);

    const chart = tasks.first();
    await expect(chart).toHaveAttribute('data-render-state', 'succeeded', { timeout: 15_000 });
    await expect(chart.locator('.render-task-output svg')).toBeVisible();
    await expect(chart.locator('text').filter({ hasText: '第一季度' })).toBeVisible();
    await expect(chart.locator('text').filter({ hasText: '第四季度' })).toBeVisible();

    const nondeterministic = tasks.nth(1);
    await expect(nondeterministic).toHaveAttribute('data-render-state', 'failed');
    await expect(nondeterministic.locator('.render-task-error-detail')).toContainText(
      '不支持 random() 表达式',
    );
    const rejected = tasks.nth(2);
    await expect(rejected).toHaveAttribute('data-render-state', 'failed');
    await expect(rejected.getByText('无法呈现图表')).toBeVisible();
    await expect(rejected.locator('.render-task-error-detail')).toContainText('data.values');
    await expect(rejected.locator('.render-task-error-source')).toContainText('example.test');
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );

    await chart.getByRole('button', { name: '查看图表源码' }).click();
    const sourceDrawer = window.getByRole('complementary', { name: '图表源码' });
    await expect(sourceDrawer.getByLabel('Vega-Lite 图表源码')).toContainText('季度收入');
    await sourceDrawer.getByRole('button', { name: '关闭图表源码' }).click();

    await chart.getByRole('button', { name: '全屏查看图表' }).click();
    const focusDialog = window.getByRole('dialog', { name: '全屏图表' });
    await expect(focusDialog.locator('svg.marks')).toBeVisible();
    await expect(focusDialog.locator('text').filter({ hasText: '第四季度' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
