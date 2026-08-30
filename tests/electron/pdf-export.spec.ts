import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createDefaultReaderPreferences } from '../../packages/shared-types/src/index';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const representativePlantUmlSvgPath = resolve(repositoryRoot, 'fixtures/plantuml-sequence.svg');
const plantUmlColorPaletteSvgPath = resolve(repositoryRoot, 'fixtures/plantuml-color-palette.svg');
const servers: Server[] = [];

const preferences = (plantUmlServerUrl: string) => ({
  ...createDefaultReaderPreferences(),
  appearance: 'light' as const,
  plantUml: { serverUrl: plantUmlServerUrl },
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

const countPdfPixels = async (
  path: string,
  matches: (red: number, green: number, blue: number, alpha: number) => boolean,
): Promise<number> => {
  const bytes = await readFile(path);
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const document = await loading.promise;
  let matchingPixels = 0;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 0; index < pixels.length; index += 4) {
      if (matches(pixels[index]!, pixels[index + 1]!, pixels[index + 2]!, pixels[index + 3]!)) {
        matchingPixels += 1;
      }
    }
  }
  await loading.destroy();
  return matchingPixels;
};

interface RgbColor {
  blue: number;
  green: number;
  red: number;
}

const colorDistance = (left: RgbColor, right: RgbColor): number =>
  Math.hypot(left.red - right.red, left.green - right.green, left.blue - right.blue);

const closestFrequentColor = (
  pixels: Uint8ClampedArray,
  expected: RgbColor,
  minimumPixelCount = 200,
): { color: RgbColor; count: number } => {
  const counts = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3]! < 250) continue;
    const key = `${pixels[index]!},${pixels[index + 1]!},${pixels[index + 2]!}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const [key, count] =
    [...counts]
      .filter((entry) => entry[1] >= minimumPixelCount)
      .sort((left, right) => {
        const toColor = ([value]: [string, number]): RgbColor => {
          const [red, green, blue] = value.split(',').map(Number);
          return { blue: blue!, green: green!, red: red! };
        };
        return colorDistance(toColor(left), expected) - colorDistance(toColor(right), expected);
      })[0] ?? [];
  if (!key || count === undefined)
    throw new Error(`No frequent pixels found for ${JSON.stringify(expected)}.`);
  const [red, green, blue] = key.split(',').map(Number);
  return { color: { blue: blue!, green: green!, red: red! }, count };
};

const rasterizePng = async (png: Buffer): Promise<Uint8ClampedArray> => {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height).data;
};

const rasterizePdf = async (path: string): Promise<Uint8ClampedArray> => {
  const bytes = await readFile(path);
  const loading = getDocument({ data: new Uint8Array(bytes) });
  const document = await loading.promise;
  const page = await document.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({
    canvas: canvas as unknown as HTMLCanvasElement,
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  await loading.destroy();
  return pixels;
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

test('preserves PlantUML colors in PDF', async () => {
  test.setTimeout(90_000);
  const server = await startDeferredPlantUmlServer();
  const pdfDirectory = resolve(repositoryRoot, 'tmp/pdfs');
  await mkdir(pdfDirectory, { recursive: true });
  const directory = await mkdtemp(join(pdfDirectory, 'plantuml-color-'));
  const sourcePath = join(directory, 'plantuml-color.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const outputPath = join(directory, 'plantuml-color.pdf');
  const svg = await readFile(plantUmlColorPaletteSvgPath, 'utf8');
  await writeFile(
    sourcePath,
    '# PlantUML color fidelity\n\n```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```',
  );
  await writeFile(preferencesPath, JSON.stringify(preferences(server.url)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const response = await server.nextRequest();
    response.end(svg);
    const visibleSvg = window
      .frameLocator('iframe[title="Finished document"]')
      .locator('[data-render-task-kind="plantuml"] .render-task-output > svg');
    await expect(visibleSvg).toBeVisible({ timeout: 10_000 });
    await window.waitForTimeout(200);
    const screenPixels = await rasterizePng(await visibleSvg.screenshot());
    const screenSvgMarkup = await visibleSvg.evaluate((element) => element.outerHTML);

    await window.getByRole('button', { name: '导出 PDF' }).click();
    const exportWindow = await findExportWindow(electronApp);
    const exportSvg = exportWindow.locator(
      '[data-render-task-kind="plantuml"] .render-task-output > svg',
    );
    await expect(exportSvg).toBeVisible();
    expect(await exportSvg.evaluate((element) => element.outerHTML)).toBe(screenSvgMarkup);
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(1);
    const firstPdfPixels = await rasterizePdf(outputPath);

    const expectedColors: RgbColor[] = [
      { blue: 77, green: 43, red: 23 },
      { blue: 204, green: 82, red: 0 },
      { blue: 11, green: 53, red: 222 },
      { blue: 255, green: 242, red: 233 },
      { blue: 88, green: 56, red: 37 },
      { blue: 48, green: 86, red: 255 },
      { blue: 192, green: 84, red: 101 },
      { blue: 90, green: 135, red: 0 },
      { blue: 148, green: 177, red: 89 },
    ];
    for (const expected of expectedColors) {
      const screen = closestFrequentColor(screenPixels, expected);
      const pdf = closestFrequentColor(firstPdfPixels, expected);
      expect.soft(screen.count).toBeGreaterThan(200);
      expect.soft(colorDistance(screen.color, expected)).toBeLessThanOrEqual(35);
      expect.soft(pdf.count).toBeGreaterThan(200);
      expect.soft(colorDistance(pdf.color, expected)).toBeLessThanOrEqual(3);
      expect.soft(colorDistance(pdf.color, screen.color)).toBeLessThanOrEqual(35);
    }

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('正在准备文档')).toBeVisible();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(1);
    const secondPdfPixels = await rasterizePdf(outputPath);
    for (const expected of expectedColors) {
      expect(closestFrequentColor(secondPdfPixels, expected).color).toEqual(
        closestFrequentColor(firstPdfPixels, expected).color,
      );
    }
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
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
  const representativePlantUmlSvg = await readFile(representativePlantUmlSvgPath, 'utf8');
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
      '> [!IMPORTANT] Export callout',
      '> Callout content remains semantic and selectable.',
      '',
      '![Local pixel](./pixel.png)',
      '',
      '`selectable-code`',
      '',
      '```typescript',
      'const selectableTheme = "github-dark";',
      '```',
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
      '',
      '```vega-lite',
      JSON.stringify({
        data: {
          values: [
            { category: 'Vega Alpha', value: 12 },
            { category: 'Vega Beta', value: 20 },
          ],
        },
        encoding: {
          x: { field: 'category', type: 'nominal' },
          y: { field: 'value', type: 'quantitative' },
        },
        height: 120,
        mark: { color: '#0052cc', type: 'bar' },
        width: 260,
      }),
      '```',
    ].join('\n'),
  );
  await writeFile(
    preferencesPath,
    JSON.stringify({
      ...preferences(server.url),
      codeHighlight: { theme: 'github-dark' },
    }),
  );
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, outputPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const visibleResponse = await server.nextRequest();
    visibleResponse.end(representativePlantUmlSvg);
    const visibleVegaLite = window
      .frameLocator('iframe[title="Finished document"]')
      .locator('[data-render-task-kind="vega-lite"] .render-task-output svg');
    await expect(visibleVegaLite).toBeVisible({ timeout: 15_000 });
    const visibleVegaLiteSnapshot = await visibleVegaLite.evaluate((svg) => svg.outerHTML);
    await window.getByRole('button', { name: '导出 PDF' }).click();
    const exportWindow = await findExportWindow(electronApp);
    await expect(exportWindow.getByRole('heading', { name: 'Deterministic export' })).toBeVisible();
    await expect(exportWindow.locator('html')).toHaveAttribute('data-code-theme', 'github-dark');
    const exportedCode = exportWindow.locator('.code-block');
    await expect(exportedCode).toBeVisible();
    expect(
      await exportedCode.evaluate((block) => {
        const code = block.querySelector('code');
        const pre = block.querySelector('pre');
        if (!code || !pre) throw new Error('Exported code block is incomplete.');
        const selection = globalThis.getSelection();
        const range = document.createRange();
        range.selectNodeContents(code);
        selection?.removeAllRanges();
        selection?.addRange(range);
        const selectedText = selection?.toString();
        selection?.removeAllRanges();
        return {
          background: getComputedStyle(pre).backgroundColor,
          selectedText,
        };
      }),
    ).toEqual({
      background: 'rgb(13, 17, 23)',
      selectedText: 'const selectableTheme = "github-dark";',
    });
    await expect(
      exportWindow.locator('.callout[data-callout-type="important"] .callout-header'),
    ).toHaveText('Export callout');
    await expect
      .poll(() =>
        exportWindow
          .locator('p')
          .first()
          .evaluate((paragraph) => {
            const style = getComputedStyle(paragraph);
            return { fontFamily: style.fontFamily, fontSize: style.fontSize };
          }),
      )
      .toEqual({
        fontFamily: 'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
        fontSize: '15px',
      });
    await expect(exportWindow.locator('img[alt="Local pixel"]')).toHaveJSProperty('complete', true);
    await expect(exportWindow.locator('.math-render-task math')).toBeVisible({ timeout: 10_000 });
    await expect(
      exportWindow.locator('[data-render-task-kind="mermaid"] .render-task-output svg'),
    ).toBeVisible({ timeout: 10_000 });
    const exportedVegaLite = exportWindow.locator(
      '[data-render-task-kind="vega-lite"] .render-task-output svg',
    );
    await expect(exportedVegaLite).toBeVisible({ timeout: 15_000 });
    expect(
      await exportedVegaLite.evaluate((svg) => {
        const clone = svg.cloneNode(true) as SVGElement;
        for (const element of [clone, ...clone.querySelectorAll('*')]) {
          element.removeAttribute('data-ref');
        }
        return clone.outerHTML;
      }),
    ).toBe(visibleVegaLiteSnapshot);
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });
    expect(server.requestCount()).toBe(1);

    const first = await inspectPdf(outputPath);
    expect(first.text).toContain('Deterministic export');
    expect(first.text).toContain('selectable-code');
    expect(first.text).toContain('selectableTheme');
    expect(first.text).toContain('github-dark');
    expect(first.text).toContain('Export callout');
    expect(first.text).toContain('Callout content remains semantic and selectable.');
    expect(first.text).toContain('Authentication Request');
    expect(first.text).toContain('Vega Alpha');
    expect(first.text).toContain('Vega Beta');
    expect(first.links).toContain('https://openai.com/');
    expect(
      await countPdfPixels(
        outputPath,
        (red, green, blue, alpha) =>
          alpha > 250 && red >= 215 && red <= 235 && green >= 215 && green <= 235 && blue >= 230,
      ),
    ).toBeGreaterThan(500);

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
  const representativePlantUmlSvg = await readFile(representativePlantUmlSvgPath, 'utf8');
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
        representativePlantUmlSvg
          .replace(' textLength="152.953"', '')
          .replace('Authentication Request', label),
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
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 160" style="width:640px;height:360px"><text x="16" y="32">${label}</text></svg>`,
      );
    }
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .locator('[data-render-task-kind="plantuml"] .render-task-output svg'),
    ).toHaveCount(3);

    await window.getByRole('button', { name: '导出 PDF' }).click();
    const exportWindow = await findExportWindow(electronApp);
    const exportedDiagrams = exportWindow.locator(
      '[data-render-task-kind="plantuml"] .render-task-output > svg',
    );
    await expect(exportedDiagrams).toHaveCount(3);
    const exportedRatios = await exportedDiagrams.evaluateAll((svgs) =>
      svgs.map((svg) => {
        const box = svg.getBoundingClientRect();
        return box.width / box.height;
      }),
    );
    for (const ratio of exportedRatios) expect.soft(ratio).toBeCloseTo(4, 2);
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
