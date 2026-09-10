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

test('sizes responsive charts to the document and preserves their paper and PDF snapshots', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-responsive-'));
  const documentPath = join(directory, 'responsive.md');
  const outputPath = join(directory, 'responsive.pdf');
  const source = process.env.FUXIAN_E2E_VEGA_DOCUMENT
    ? await readFile(process.env.FUXIAN_E2E_VEGA_DOCUMENT, 'utf8')
    : [
        '# Responsive charts',
        '```vega-lite',
        JSON.stringify({
          title: 'Responsive comparison',
          width: 'container',
          height: 160,
          datasets: {
            table: [
              { category: 'Alpha', current: 10, previous: 5 },
              { category: 'Beta', current: 20, previous: 15 },
            ],
          },
          data: { name: 'table' },
          params: [{ name: 'minimum', value: 0 }],
          transform: [{ fold: ['current', 'previous'] }, { filter: 'datum.value >= minimum' }],
          encoding: {
            y: { field: 'category', type: 'nominal' },
            x: { field: 'value', type: 'quantitative' },
            tooltip: [{ field: 'category' }, { field: 'value', type: 'quantitative' }],
          },
          layer: [
            { mark: { type: 'bar', height: { expr: '20' } } },
            {
              mark: { type: 'text', align: 'left', dx: 5 },
              encoding: { text: { field: 'value' } },
            },
          ],
        }),
        '```',
      ].join('\n');
  const specs = [...source.matchAll(/```vega-lite\s*\n([\s\S]*?)```/gu)].map(
    (match) => JSON.parse(match[1]!) as { title?: string | { text?: string } },
  );
  expect(specs.length).toBeGreaterThan(0);
  await writeFile(documentPath, source);
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_SOURCE_DOCUMENT: documentPath,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      NODE_ENV: 'test',
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1600, height: 1000 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const frame = window.frameLocator('iframe[data-finished-document="active"]');
    const charts = frame.locator('[data-render-task-kind="vega-lite"]');
    await expect(charts).toHaveCount(specs.length);
    for (const chart of await charts.all()) {
      await expect(chart).toHaveAttribute('data-render-state', 'succeeded', { timeout: 20_000 });
    }
    const svg = charts.first().locator('.render-task-output > svg');
    const initialWidth = Number(await svg.getAttribute('width'));
    expect(initialWidth).toBeGreaterThan(600);
    await expect
      .poll(async () =>
        Math.abs(
          Number(await svg.getAttribute('width')) -
            (await charts.first().evaluate((element) => element.clientWidth)),
        ),
      )
      .toBeLessThan(30);
    await expect(svg.locator('[data-vega-tooltip]').first()).toBeAttached();

    await window.setViewportSize({ width: 1280, height: 900 });
    await expect
      .poll(async () => Number(await svg.getAttribute('width')))
      .toBeLessThan(initialWidth - 100);
    for (const chart of await charts.all()) {
      await expect(chart).toHaveAttribute('data-render-state', 'succeeded');
    }
    const snapshots = await charts
      .locator('.render-task-output > svg')
      .evaluateAll((elements) => elements.map((element) => element.getAttribute('viewBox')));
    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    await expect(window.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 20_000 });
    const paperCharts = paper.locator(
      '[data-render-task-kind="vega-lite"] .render-task-output > svg',
    );
    await expect(paperCharts).toHaveCount(specs.length, { timeout: 20_000 });
    await expect
      .poll(() =>
        paperCharts.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute('viewBox')),
        ),
      )
      .toEqual(snapshots);
    const browserWindow = await electronApp.browserWindow(window);
    await paperCharts.first().evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(paperCharts.first()).toBeInViewport();
    const screenshot = await browserWindow.evaluate(async (browserWindow) => {
      const image = await browserWindow.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      });
      return image.toPNG().toString('base64');
    });
    await writeFile(
      test.info().outputPath('responsive-paper.png'),
      Buffer.from(screenshot, 'base64'),
    );
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    const pdfText = await readPdfText(outputPath);
    await test
      .info()
      .attach('responsive.pdf', { path: outputPath, contentType: 'application/pdf' });
    for (const spec of specs) {
      const title = typeof spec.title === 'string' ? spec.title : spec.title?.text;
      if (title) expect(pdfText).toContain(title.normalize('NFKC').replace(/\s+/gu, ''));
    }
  } finally {
    await electronApp.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('renders and exports concatenated charts with discrete step heights', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-step-'));
  const documentPath = join(directory, 'step.md');
  const outputPath = join(directory, 'step.pdf');
  const source = process.env.FUXIAN_E2E_VEGA_SOURCE
    ? await readFile(process.env.FUXIAN_E2E_VEGA_SOURCE, 'utf8')
    : JSON.stringify({
        data: {
          values: [
            { module: 'review', mismatch: 3, rate: 0.03 },
            { module: 'searchProduct', mismatch: 2, rate: 0.01 },
          ],
        },
        hconcat: ['mismatch', 'rate'].map((field, index) => ({
          title: index === 0 ? 'Counts' : 'Rates',
          width: 340,
          height: { step: 24 },
          mark: index === 0 ? 'bar' : { type: 'point', filled: true, size: 70 },
          encoding: {
            y: { field: 'module', type: 'nominal', title: null },
            x: { field, type: 'quantitative' },
          },
        })),
      });
  await writeFile(documentPath, ['# Step sizing', '```vega-lite', source, '```'].join('\n'));
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: documentPath,
      NODE_ENV: 'test',
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const document = window.frameLocator('iframe[data-finished-document="active"]');
    const svg = document.locator('[data-render-task-kind="vega-lite"] > .render-task-output > svg');
    await expect(svg).toBeVisible();
    await expect(svg.locator('.role-mark')).toHaveCount(2);
    await expect(svg).toContainText('review');
    await expect(svg).toContainText('searchProduct');
    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paperSvg = window
      .frameLocator('iframe[title="纸张预览"]')
      .locator('.render-task-output > svg');
    await expect(paperSvg).toBeVisible();
    await expect(paperSvg).toContainText('searchProduct');
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    const text = await readPdfText(outputPath);
    expect(text).toContain('review');
    expect(text).toContain('searchProduct');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('preserves authored tooltips across reading, focused, and paper views', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-tooltip-'));
  const documentPath = join(directory, 'tooltip.md');
  const outputPath = join(directory, 'tooltip.pdf');
  const specification = {
    data: {
      values: [{ category: 'Alpha', rate: 0.03125, detail: '<img src=x onerror=alert(1)>' }],
    },
    width: 320,
    height: 180,
    mark: 'bar',
    encoding: {
      x: { field: 'category', type: 'nominal' },
      y: { field: 'rate', type: 'quantitative' },
      tooltip: [
        { field: 'category', title: 'Module' },
        { field: 'rate', type: 'quantitative', title: 'Rate', format: '.2%' },
        { field: 'detail', title: 'Literal text' },
      ],
    },
  };
  await writeFile(
    documentPath,
    [
      '# Tooltip',
      '```vega-lite',
      JSON.stringify(specification),
      '```',
      '```vega-lite',
      JSON.stringify({ ...specification, encoding: { ...specification.encoding, tooltip: null } }),
      '```',
    ].join('\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FUXIAN_E2E_SOURCE_DOCUMENT: documentPath,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
    },
  });
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const frame = window.frameLocator('iframe[data-finished-document="active"]');
    const charts = frame.locator('[data-render-task-kind="vega-lite"]');
    const mark = charts.first().locator('[data-vega-tooltip]').first();
    await expect(mark).toBeVisible();
    await mark.hover();
    const tooltip = frame.getByRole('tooltip');
    await expect(tooltip).toContainText('Module');
    await expect(tooltip).toContainText('3.13%');
    await expect(tooltip).toContainText('<img src=x onerror=alert(1)>');
    await expect(tooltip.locator('img')).toHaveCount(0);
    const tooltipLayout = await tooltip.evaluate((element) => {
      const label = element.querySelector('th')!;
      const value = element.querySelector('td')!;
      const bounds = element.getBoundingClientRect();
      return {
        labelColor: getComputedStyle(label).color,
        textColor: getComputedStyle(element).color,
        topGap: label.getBoundingClientRect().top - bounds.top,
        valueOffset: value.getBoundingClientRect().left - bounds.left,
      };
    });
    expect(tooltipLayout.labelColor).toBe(tooltipLayout.textColor);
    expect(tooltipLayout.topGap).toBeLessThanOrEqual(10);
    expect(tooltipLayout.valueOffset).toBeLessThan(110);
    const readingScreenshot = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const image = await BrowserWindow.getAllWindows()[0]!.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      });
      return image.toPNG().toString('base64');
    });
    await writeFile(
      test.info().outputPath('vega-tooltip-reading.png'),
      Buffer.from(readingScreenshot, 'base64'),
    );
    await frame.getByRole('heading', { name: 'Tooltip', exact: true }).hover();
    await expect(tooltip).not.toBeVisible();
    await mark.focus();
    await expect(tooltip).toBeVisible();
    await window.keyboard.press('Escape');
    await expect(tooltip).not.toBeVisible();
    await expect(charts.nth(1).locator('.render-task-output > svg')).toBeVisible();
    await expect(charts.nth(1).locator('[data-vega-tooltip]')).toHaveCount(0);
    await charts.first().hover();
    await charts.first().getByRole('button', { name: '全屏查看图表' }).click();
    const dialog = window.getByRole('dialog', { name: '全屏图表' });
    await dialog.locator('[data-vega-tooltip]').first().hover();
    await expect(window.getByRole('tooltip')).toContainText('3.13%');
    const screenshot = await electronApp.evaluate(async ({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      const image = await window.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      });
      return image.toPNG().toString('base64');
    });
    await writeFile(test.info().outputPath('vega-tooltip.png'), Buffer.from(screenshot, 'base64'));
    await window.keyboard.press('Escape');
    await window.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    await paper.locator('[data-vega-tooltip]').first().hover();
    await expect(paper.getByRole('tooltip')).toContainText('3.13%');
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    const pdfText = await readPdfText(outputPath);
    expect(pdfText).toContain('Alpha');
    expect(pdfText).not.toContain('Literaltext');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

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

    const sampled = tasks.nth(1);
    await expect(sampled).toHaveAttribute('data-render-state', 'succeeded');
    await expect(sampled.locator('.render-task-output svg')).toBeVisible();
    const rejected = tasks.nth(2);
    await expect(rejected).toHaveAttribute('data-render-state', 'failed');
    await expect(rejected.getByText('无法呈现图表')).toBeVisible();
    await expect(rejected.locator('.render-task-error-detail')).toContainText('外部数据源');
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
