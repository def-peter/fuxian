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

const diagrams = [
  [
    'flowchart',
    'flowchart LR\n  FlowStart[Flow start] --> FlowEnd[Flow end]',
    ['Flow start', 'Flow end'],
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
    for (const [index, [, , labels]] of diagrams.entries()) {
      const task = tasks.nth(index);
      await expect(task).toHaveAttribute('data-render-state', 'succeeded', { timeout: 15_000 });
      for (const label of labels) await expect(task).toContainText(label);
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
