import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const servers: Server[] = [];

const preferences = (plantUmlServerUrl: string) => ({
  appearance: 'light',
  diagram: { optimize: false },
  documentTypography: { bodyFamily: 'serif', bodySize: 17, lineHeight: 1.85 },
  documentWidth: { customWidth: 860, mode: 'adaptive' },
  plantUml: { serverUrl: plantUmlServerUrl },
  version: 1,
});

const launchDesktop = (
  sourcePath: string,
  preferencesPath: string,
  sessionPath: string,
  outputPath: string,
  extraEnvironment: Record<string, string> = {},
): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      ...extraEnvironment,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
      FUXIAN_E2E_SESSION_FILE: sessionPath,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

const startDeferredPlantUmlServer = async (): Promise<{
  nextRequest(): Promise<ServerResponse>;
  requestCount(): number;
  url: string;
}> => {
  let requestCount = 0;
  const responses: ServerResponse[] = [];
  const waiters: Array<(response: ServerResponse) => void> = [];
  const server = createServer((_request, response) => {
    requestCount += 1;
    const waiter = waiters.shift();
    if (waiter) waiter(response);
    else responses.push(response);
  });
  servers.push(server);
  await new Promise<void>((resolveListening) => server.listen(0, '127.0.0.1', resolveListening));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PlantUML server did not bind.');
  return {
    nextRequest: () =>
      responses.length > 0
        ? Promise.resolve(responses.shift()!)
        : new Promise((resolveResponse) => waiters.push(resolveResponse)),
    requestCount: () => requestCount,
    url: `http://127.0.0.1:${address.port}/plantuml`,
  };
};

const findExportWindow = async (electronApp: ElectronApplication): Promise<Page> => {
  await expect.poll(async () => (await electronApp.windows()).length).toBe(2);
  const window = (await electronApp.windows()).find((candidate) =>
    candidate.url().includes('view=pdf-export'),
  );
  if (!window) throw new Error('PDF export window was not created.');
  return window;
};

const inspectPdf = async (
  path: string,
): Promise<{ links: string[]; pages: number; text: string }> => {
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const document = await loading.promise;
  const text: string[] = [];
  const links: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' '));
    const annotations = await page.getAnnotations();
    links.push(...annotations.flatMap((annotation) => (annotation.url ? [annotation.url] : [])));
  }
  const pages = document.numPages;
  await loading.destroy();
  return { links, pages, text: text.join('\n') };
};

test.afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolveClosed) => {
          server.closeAllConnections();
          server.close(() => resolveClosed());
        }),
    ),
  );
});

test('exports complete finished-document content with stable pagination', async () => {
  test.setTimeout(90_000);
  const server = await startDeferredPlantUmlServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-pdf-'));
  const sourcePath = join(directory, 'export.md');
  const imagePath = join(directory, 'pixel.png');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'export.pdf');
  await writeFile(
    imagePath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
  );
  await writeFile(
    sourcePath,
    [
      '# Deterministic export',
      '',
      '[OpenAI](https://openai.com/)',
      '',
      '![Local pixel](./pixel.png)',
      '',
      '`selectable-code`',
      '',
      '$$E = mc^2$$',
      '',
      '```mermaid',
      'graph TD',
      '  A[Mermaid start] --> B[Mermaid end]',
      '```',
      '',
      '```plantuml',
      '@startuml',
      'Alice -> Bob: Plant diagram',
      '@enduml',
      '```',
    ].join('\n'),
  );
  await writeFile(preferencesPath, JSON.stringify(preferences(server.url)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const visibleResponse = await server.nextRequest();
    visibleResponse.end(
      '<svg xmlns="http://www.w3.org/2000/svg"><text x="4" y="14">Plant diagram</text></svg>',
    );
    await window.getByRole('button', { name: '导出 PDF' }).click();
    const exportWindow = await findExportWindow(electronApp);
    await expect(exportWindow.getByRole('heading', { name: 'Deterministic export' })).toBeVisible();
    await expect(exportWindow.locator('img[alt="Local pixel"]')).toHaveJSProperty('complete', true);
    await expect(exportWindow.locator('.math-render-task math')).toBeVisible({ timeout: 10_000 });
    await expect(
      exportWindow.locator('[data-render-task-kind="mermaid"] .render-task-output svg'),
    ).toBeVisible({ timeout: 10_000 });
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(1);

    const first = await inspectPdf(outputPath);
    expect(first.text).toContain('Deterministic export');
    expect(first.text).toContain('selectable-code');
    expect(first.text).toContain('Plant diagram');
    expect(first.links).toContain('https://openai.com/');

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('正在准备文档')).toBeVisible();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(1);
    const second = await inspectPdf(outputPath);
    expect(second.pages).toBe(first.pages);
    expect(second.text.replace(/\s+/gu, ' ')).toBe(first.text.replace(/\s+/gu, ' '));
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('exports every PlantUML diagram from a multi-diagram document', async () => {
  test.setTimeout(90_000);
  const server = await startDeferredPlantUmlServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-pdf-multi-plantuml-'));
  const sourcePath = join(directory, 'multi-plantuml.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'multi-plantuml.pdf');
  const labels = ['Plant diagram one', 'Plant diagram two', 'Plant diagram three'];
  await writeFile(
    sourcePath,
    [
      '# Multiple PlantUML diagrams',
      '',
      ...labels.flatMap((label, index) => [
        `## Diagram ${index + 1}`,
        '',
        '```plantuml',
        '@startuml',
        `Alice -> Bob: ${label}`,
        '@enduml',
        '```',
        '',
      ]),
    ].join('\n'),
  );
  await writeFile(preferencesPath, JSON.stringify(preferences(server.url)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  const answerPlantUmlRequests = async (): Promise<void> => {
    for (const label of labels) {
      const response = await server.nextRequest();
      response.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><text x="16" y="32">${label}</text></svg>`,
      );
    }
  };

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await answerPlantUmlRequests();
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(3);

    const result = await inspectPdf(outputPath);
    for (const label of labels) expect(result.text).toContain(label);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('reuses visible PlantUML diagrams without export-time requests', async () => {
  test.setTimeout(90_000);
  const server = await startDeferredPlantUmlServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-pdf-plantuml-reuse-'));
  const sourcePath = join(directory, 'plantuml-reuse.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'plantuml-reuse.pdf');
  const renderedLabels = ['Rendered plant one', 'Rendered plant two', 'Rendered plant three'];
  await writeFile(
    sourcePath,
    [
      '# Reuse visible diagrams',
      '',
      ...renderedLabels.flatMap((_label, index) => [
        `## Source diagram ${index + 1}`,
        '',
        '```plantuml',
        '@startuml',
        `A${index} -> B${index}`,
        '@enduml',
        '```',
        '',
      ]),
    ].join('\n'),
  );
  await writeFile(preferencesPath, JSON.stringify(preferences(server.url)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    for (const label of renderedLabels) {
      const response = await server.nextRequest();
      response.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><text x="16" y="32">${label}</text></svg>`,
      );
    }
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .locator('[data-render-task-kind="plantuml"] .render-task-output svg'),
    ).toHaveCount(3);

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(3);

    const result = await inspectPdf(outputPath);
    for (const label of renderedLabels) expect(result.text).toContain(label);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('cancels an in-flight export without writing a PDF', async () => {
  const server = await startDeferredPlantUmlServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-pdf-cancel-'));
  const sourcePath = join(directory, 'cancel.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'cancel.pdf');
  await writeFile(sourcePath, '# Cancel export\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```');
  await writeFile(preferencesPath, JSON.stringify(preferences(server.url)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('button', { name: '导出 PDF' }).click();
    const response = await server.nextRequest();
    await window.getByRole('button', { name: '取消', exact: true }).click();
    await expect(window.getByText('导出已取消')).toBeVisible();
    await expect.poll(async () => (await electronApp.windows()).length).toBe(1);
    await expect(
      access(outputPath).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false);
    response.end();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('reports generation failures and offers retry', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-pdf-failure-'));
  const sourcePath = join(directory, 'failure.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'failure.pdf');
  await writeFile(sourcePath, '# Failed export');
  await writeFile(preferencesPath, JSON.stringify(preferences('http://127.0.0.1:1/plantuml')));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath, {
    FUXIAN_E2E_PDF_EXPORT_FAILURE: 'print',
  });

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('导出失败')).toBeVisible({ timeout: 10_000 });
    await expect(window.getByRole('button', { name: '重试' })).toBeVisible();
    await expect(
      access(outputPath).then(
        () => true,
        () => false,
      ),
    ).resolves.toBe(false);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('prints a recognizable placeholder after a diagram timeout', async () => {
  test.setTimeout(45_000);
  const server = await startDeferredPlantUmlServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-pdf-timeout-'));
  const sourcePath = join(directory, 'timeout.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'timeout.pdf');
  await writeFile(sourcePath, '# Timeout export\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```');
  await writeFile(preferencesPath, JSON.stringify(preferences(server.url)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await server.nextRequest();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 25_000 });
    const result = await inspectPdf(outputPath);
    expect(result.text).toContain('Timeout export');
    expect(result.text).toContain('渲染超时');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
