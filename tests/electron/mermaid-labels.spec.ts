import { _electron as electron, expect, test, type Locator } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { captureElectronWindow } from './capture-window';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

const diagrams = [
  [
    'flowchart',
    'flowchart LR\n  FlowStart[Flow start] --> FlowEnd[Flow end]',
    ['Flow start', 'Flow end'],
  ],
  [
    'flowchart-wrapped',
    'flowchart TB\n  A["`A long label with **bold** text that wraps across multiple lines without losing the authored content`"] --> B["First line<br/>Second line"]',
    [
      'A long label with bold text that wraps across multiple lines without losing the authored content',
      'First line',
      'Second line',
    ],
  ],
  [
    'sequence',
    'sequenceDiagram\n  participant Alice\n  participant Bob\n  Alice->>Bob: Sequence hello',
    ['Alice', 'Bob', 'Sequence hello'],
  ],
  [
    'class',
    'classDiagram\n  class MermaidClass\n  MermaidClass : +render()',
    ['MermaidClass', 'render()'],
  ],
  [
    'state',
    'stateDiagram-v2\n  [*] --> ReadyState\n  ReadyState --> DoneState',
    ['ReadyState', 'DoneState'],
  ],
  [
    'mindmap',
    'mindmap\n  root((MindmapRoot))\n    MindmapBranch',
    ['MindmapRoot', 'MindmapBranch'],
  ],
] as const;

const readPdfText = async (path: string): Promise<string> => {
  const bytes = await readFile(path);
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loading.promise;
  const text: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    text.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' '));
  }
  await loading.destroy();
  return text.join(' ').normalize('NFKC').replace(/\s+/gu, ' ');
};

const expectCompleteNodeLabels = async (
  diagram: Locator,
  labels?: readonly string[],
): Promise<void> => {
  const measurements = await diagram.locator('.node foreignObject').evaluateAll((elements) =>
    elements.map((element) => {
      const viewport = element.getBoundingClientRect();
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      const text = range.getBoundingClientRect();
      return {
        label: element.textContent,
        clipped:
          text.left < viewport.left - 1 ||
          text.right > viewport.right + 1 ||
          text.top < viewport.top - 1 ||
          text.bottom > viewport.bottom + 1,
        viewportWidth: viewport.width,
        textWidth: text.width,
        viewportHeight: viewport.height,
        textHeight: text.height,
      };
    }),
  );
  expect(measurements.length).toBeGreaterThan(0);
  if (labels) expect(measurements.map(({ label }) => label).sort()).toEqual([...labels].sort());
  expect(measurements.filter(({ clipped }) => clipped)).toEqual([]);
};

test('keeps long unbroken Mermaid table names inside their label viewports', async () => {
  test.setTimeout(60_000);
  const testInfo = test.info();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-mermaid-long-labels-'));
  const sourcePath = join(directory, 'mermaid-long-labels.md');
  const outputPath = testInfo.outputPath('long-labels.pdf');
  const labels = [
    'bi_dw.tags_user_purchase_lifecycle_di',
    'bi_dw.dim_user_ops_category_map_df',
    'bi_dw.dws_user_paid_category_history_di',
    'bi_dw.tags_user_category_purchase_state_di',
    'bi_dw.ads_user_growth_audience_di',
  ];
  await writeFile(
    sourcePath,
    [
      '# Mermaid long table names',
      '',
      '```mermaid',
      'flowchart TB',
      ...labels.map((label, index) => `  N${index}["${label}"]`),
      '  N0 --> N3',
      '  N1 --> N3',
      '  N2 --> N3',
      '  N0 --> N4',
      '  N3 --> N4',
      '```',
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
    const diagram = window
      .frameLocator('iframe[data-finished-document="active"]')
      .locator('[data-render-task-kind="mermaid"]');
    await expect(diagram).toHaveAttribute('data-render-state', 'succeeded', { timeout: 15_000 });
    await expectCompleteNodeLabels(diagram, labels);
    await diagram.locator('.render-task-output').evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await captureElectronWindow(electronApp, window, testInfo.outputPath('long-labels.png'));

    await diagram.evaluate((element) => {
      const root = element.ownerDocument.documentElement;
      root.style.setProperty('--document-body-size', '22px');
      root.style.setProperty('--document-line-height', '2.2');
    });
    await expectCompleteNodeLabels(diagram, labels);

    await diagram.getByRole('button', { name: '全屏查看图表' }).click();
    const focusDialog = window.getByRole('dialog', { name: '全屏图表' });
    await expect(focusDialog).toBeVisible();
    await expectCompleteNodeLabels(focusDialog, labels);
    await window.keyboard.press('Escape');

    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paperDiagram = window
      .frameLocator('iframe[title="纸张预览"]')
      .locator('.pagedjs_page [data-render-task-kind="mermaid"]');
    await expect(paperDiagram).toBeVisible({ timeout: 15_000 });
    await expectCompleteNodeLabels(paperDiagram, labels);

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 30_000 });
    const pdfText = await readPdfText(outputPath);
    for (const label of labels) expect(pdfText).toContain(label);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('preserves representative Mermaid labels on screen and in PDF', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-mermaid-labels-'));
  const sourcePath = join(directory, 'mermaid-labels.md');
  const outputPath = join(directory, 'mermaid-labels.pdf');
  await writeFile(
    sourcePath,
    [
      '# Mermaid label matrix',
      ...diagrams.flatMap(([name, source]) => ['', `## ${name}`, '', '```mermaid', source, '```']),
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
    const tasks = window
      .frameLocator('iframe[data-finished-document="active"]')
      .locator('[data-render-task-kind="mermaid"]');
    await expect(tasks).toHaveCount(diagrams.length);
    for (const [index, [name, , labels]] of diagrams.entries()) {
      const task = tasks.nth(index);
      await expect(task).toHaveAttribute('data-render-state', 'succeeded', { timeout: 15_000 });
      for (const label of labels) await expect(task).toContainText(label);
      if (name.startsWith('flowchart')) await expectCompleteNodeLabels(task);
      if (name === 'flowchart-wrapped')
        await expect(task.locator('.render-task-output strong')).toHaveText('bold');
    }

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 30_000 });
    const pdfText = await readPdfText(outputPath);
    for (const [, , labels] of diagrams) {
      for (const label of labels) expect(pdfText).toContain(label);
    }
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
