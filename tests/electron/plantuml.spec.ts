import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { createServer, type RequestListener, type Server } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const servers: Server[] = [];

const startServer = async (handler: RequestListener): Promise<string> => {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolveListening) => server.listen(0, '127.0.0.1', resolveListening));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  return `http://127.0.0.1:${address.port}/plantuml`;
};

const createPreferences = (serverUrl: string) => ({
  appearance: 'light',
  documentTypography: { bodyFamily: 'serif', bodySize: 17, lineHeight: 1.85 },
  documentWidth: { customWidth: 860, mode: 'adaptive' },
  plantUml: { serverUrl },
  version: 1,
});

const launchDesktop = (
  sourceDocumentPath: string,
  preferencesFilePath: string,
  sessionFilePath: string,
  pdfExportFilePath?: string,
): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesFilePath,
      FUXIAN_E2E_SESSION_FILE: sessionFilePath,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourceDocumentPath,
      ...(pdfExportFilePath ? { FUXIAN_E2E_PDF_EXPORT_FILE: pdfExportFilePath } : {}),
      NODE_ENV: 'test',
    },
  });

const getSettingsWindow = async (electronApp: ElectronApplication): Promise<Page> => {
  await expect.poll(() => electronApp.windows().length).toBe(2);
  const settingsWindow = electronApp
    .windows()
    .find((window) => new URL(window.url()).searchParams.get('view') === 'settings');
  if (!settingsWindow) throw new Error('Settings window did not open.');
  await settingsWindow.waitForLoadState('domcontentloaded');
  return settingsWindow;
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

test('keeps SVG styles local to each rendered visual', async () => {
  test.setTimeout(60_000);
  let requestCount = 0;
  const serverUrl = await startServer((_request, response) => {
    requestCount += 1;
    const color = requestCount === 1 ? '#e53935' : '#1677ff';
    const stroke = requestCount === 1 ? '#853021' : '#124a9f';
    const foreground = requestCount === 1 ? '#315a1c' : '#6a347c';
    const opacity = requestCount === 1 ? 0.2 : 0.8;
    const label = requestCount === 1 ? 'First visual' : 'Second visual';
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    response.end(
      `<svg xmlns="http://www.w3.org/2000/svg" class="svg-root" viewBox="0 0 160 60">` +
        `<style>svg{stroke:${stroke}}:root{color:${foreground}}` +
        `.svg-root{stroke-width:3px}.svg-root > .shared-bar{stroke-linecap:round}` +
        `@media (min-width:1px){.shared-bar{fill:${color}}}` +
        `@keyframes pulse{from{opacity:${opacity}}to{opacity:${opacity}}}` +
        `.animated{animation:pulse .1s linear infinite}</style>` +
        `<rect class="shared-bar" x="0" y="0" width="100" height="30"/>` +
        `<circle class="animated" cx="120" cy="15" r="5"/>` +
        `<text x="0" y="55">${label}</text></svg>`,
    );
  });
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-svg-style-scope-'));
  const sourcePath = join(directory, 'two-visuals.md');
  const pdfPath = join(directory, 'two-visuals.pdf');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  await writeFile(
    sourcePath,
    '# Two visuals\n\n```plantuml\n@startuml\nAlice -> Bob: first\n@enduml\n```\n\n```plantuml\n@startuml\nAlice -> Bob: second\n@enduml\n```',
  );
  await writeFile(preferencesPath, JSON.stringify(createPreferences(serverUrl)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, pdfPath);
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const tasks = window
      .frameLocator('iframe[data-finished-document="active"]')
      .locator('[data-render-task-kind="plantuml"]');
    await expect(tasks).toHaveCount(2);
    await expect(tasks.nth(1)).toHaveAttribute('data-render-state', 'succeeded', {
      timeout: 20_000,
    });
    const colors = await tasks.locator('rect.shared-bar').evaluateAll((rects) =>
      rects.map((rect) => ({
        color: getComputedStyle(rect).fill,
        label: rect.parentElement?.querySelector('text')?.textContent,
      })),
    );
    expect(colors).toEqual([
      { color: 'rgb(229, 57, 53)', label: 'First visual' },
      { color: 'rgb(22, 119, 255)', label: 'Second visual' },
    ]);
    await expect
      .poll(() =>
        tasks
          .locator('circle.animated')
          .evaluateAll((circles) =>
            circles.map((circle) => Number(getComputedStyle(circle).opacity)),
          ),
      )
      .toEqual([0.2, 0.8]);
    expect(
      await tasks
        .locator('.render-task-output > svg')
        .evaluateAll((svgs) => svgs.map((svg) => getComputedStyle(svg).stroke)),
    ).toEqual(['rgb(133, 48, 33)', 'rgb(18, 74, 159)']);
    expect(
      await tasks
        .locator('.render-task-output > svg')
        .evaluateAll((svgs) => svgs.map((svg) => getComputedStyle(svg).color)),
    ).toEqual(['rgb(49, 90, 28)', 'rgb(106, 52, 124)']);
    expect(
      await tasks
        .locator('.render-task-output > svg')
        .evaluateAll((svgs) => svgs.map((svg) => getComputedStyle(svg).strokeWidth)),
    ).toEqual(['3px', '3px']);
    expect(
      await tasks
        .locator('rect.shared-bar')
        .evaluateAll((rects) => rects.map((rect) => getComputedStyle(rect).strokeLinecap)),
    ).toEqual(['round', 'round']);

    await tasks.first().getByRole('button', { name: '全屏查看图表' }).click();
    const focusDialog = window.getByRole('dialog', { name: '全屏图表' });
    expect(
      await focusDialog.locator('rect.shared-bar').evaluate((rect) => getComputedStyle(rect).fill),
    ).toBe('rgb(229, 57, 53)');
    await focusDialog.getByRole('button', { name: '返回文档' }).click();

    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paperTasks = window
      .frameLocator('iframe[title="纸张预览"]')
      .locator('[data-render-task-kind="plantuml"]');
    await expect(paperTasks).toHaveCount(2, { timeout: 20_000 });
    await expect(paperTasks.locator('rect.shared-bar')).toHaveCount(2, { timeout: 20_000 });
    await expect
      .poll(() =>
        paperTasks
          .locator('rect.shared-bar')
          .evaluateAll((rects) => rects.map((rect) => getComputedStyle(rect).fill)),
      )
      .toEqual(['rgb(229, 57, 53)', 'rgb(22, 119, 255)']);
    await expect
      .poll(() =>
        paperTasks
          .locator('circle.animated')
          .evaluateAll((circles) =>
            circles.map((circle) => Number(getComputedStyle(circle).opacity)),
          ),
      )
      .toEqual([0.2, 0.8]);

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 20_000 });
    const loading = getDocument({ data: new Uint8Array(await readFile(pdfPath)) });
    const pdf = await loading.promise;
    try {
      const counts = { red: 0, blue: 0 };
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext('2d');
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index]!;
          const green = pixels[index + 1]!;
          const blue = pixels[index + 2]!;
          if (red > 190 && green < 100 && blue < 100) counts.red += 1;
          if (red < 80 && green > 80 && blue > 170) counts.blue += 1;
        }
      }
      expect(counts.red).toBeGreaterThan(100);
      expect(counts.blue).toBeGreaterThan(100);
    } finally {
      await loading.destroy();
    }
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('shows a stable visual skeleton without exposing source while PlantUML is pending', async () => {
  test.setTimeout(60_000);
  let finishRequest: (() => void) | undefined;
  let requestStarted: (() => void) | undefined;
  const pendingRequest = new Promise<void>((resolveStarted) => {
    requestStarted = resolveStarted;
  });
  const serverUrl = await startServer((_request, response) => {
    finishRequest = () => {
      response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><text x="24" y="90">Ready diagram</text></svg>',
      );
    };
    requestStarted?.();
  });
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-plantuml-skeleton-'));
  const sourcePath = join(directory, 'pending.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  await writeFile(
    sourcePath,
    '# Pending\n\n```plantuml\n@startuml\nAlice -> Bob: private source\n@enduml\n```',
  );
  await writeFile(preferencesPath, JSON.stringify(createPreferences(serverUrl)));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath);
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    await pendingRequest;
    const document = window.frameLocator('iframe[data-finished-document="active"]');
    const task = document.locator('[data-render-task-kind="plantuml"]');
    await expect(task).toHaveAttribute('aria-busy', 'true');
    await expect(task.locator('.render-task-skeleton')).toBeVisible();
    await expect(task.locator('.render-task-source')).toBeHidden();

    finishRequest?.();
    await expect(task.locator('.render-task-output svg')).toBeVisible();
    await expect(task.locator('.render-task-skeleton')).toBeHidden();
    await expect(task).toHaveAttribute('aria-busy', 'false');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('validates and saves a new server, cancels the old request, and redraws selectable SVG', async () => {
  test.setTimeout(60_000);
  let oldRequestStarted: (() => void) | undefined;
  let oldRequestClosed = false;
  const oldRequest = new Promise<void>((resolveStarted) => {
    oldRequestStarted = resolveStarted;
  });
  const oldServerUrl = await startServer((_request, response) => {
    oldRequestStarted?.();
    response.on('close', () => {
      oldRequestClosed = true;
    });
  });
  let newServerRequests = 0;
  const newServerUrl = await startServer((_request, response) => {
    newServerRequests += 1;
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    response.end(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1200"><rect width="2000" height="1200" fill="white"/><text x="900" y="600">${
        newServerRequests === 1 ? 'Server validated' : 'Switched diagram'
      }</text></svg>`,
    );
  });
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-plantuml-'));
  const sourceDocumentPath = join(temporaryDirectory, 'diagram.md');
  const preferencesFilePath = join(temporaryDirectory, 'reader-preferences.json');
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  await writeFile(
    sourceDocumentPath,
    [
      '# Architecture',
      '',
      ...Array.from(
        { length: 24 },
        (_, index) => `Paragraph ${index + 1}: finished document reading position.`,
      ),
      '',
      '## Diagram',
      '',
      '```plantuml',
      '@startuml',
      '!theme mars',
      'Alice -> Bob: hello',
      '@enduml',
      '```',
      '',
      '## Follow-up',
      '',
      ...Array.from({ length: 12 }, (_, index) => `Follow-up paragraph ${index + 1}.`),
    ].join('\n\n'),
  );
  await writeFile(preferencesFilePath, JSON.stringify(createPreferences(oldServerUrl)));
  const electronApp = await launchDesktop(sourceDocumentPath, preferencesFilePath, sessionFilePath);

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.setViewportSize({ height: 900, width: 1_440 });
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();
    await oldRequest;
    await readerWindow.getByRole('button', { name: '设置' }).click();
    const settingsWindow = await getSettingsWindow(electronApp);
    await settingsWindow.getByRole('button', { name: 'PlantUML' }).click();
    await expect(settingsWindow.getByText('PlantUML 源码会发送到上方配置的服务。')).toBeVisible();
    const serverInput = settingsWindow.getByLabel('服务器地址');
    await serverInput.fill(newServerUrl);
    await settingsWindow.getByRole('button', { name: '验证并保存' }).click();
    await expect(settingsWindow.getByRole('button', { name: '已验证并保存' })).toBeVisible();
    await expect(settingsWindow.getByRole('status')).toHaveText('连接验证成功，地址已保存。');
    await expect(settingsWindow.getByText('连接成功，地址已保存。')).toHaveCount(0);

    await serverInput.fill('http://127.0.0.1:1/plantuml');
    await expect(settingsWindow.getByRole('status')).toHaveCount(0);
    await expect(settingsWindow.getByRole('button', { name: '验证并保存' })).toBeVisible();
    await settingsWindow.getByRole('button', { name: '验证并保存' }).click();
    await expect(settingsWindow.locator('[data-slot="field-error"]')).toBeVisible();
    await expect(settingsWindow.getByRole('status')).toHaveCount(0);

    await serverInput.fill(newServerUrl);
    await settingsWindow.getByRole('button', { name: '验证并保存' }).click();
    await expect(settingsWindow.getByRole('status')).toHaveText('连接验证成功，地址已保存。');

    const finishedDocument = readerWindow.frameLocator('iframe[data-finished-document="active"]');
    const plantUmlTask = finishedDocument.locator('[data-render-task-kind="plantuml"]');
    await expect(plantUmlTask.locator('text')).toHaveText('Switched diagram');
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );
    await expect.poll(() => oldRequestClosed).toBe(true);
    await expect.poll(() => newServerRequests).toBeGreaterThanOrEqual(2);
    await expect
      .poll(() =>
        plantUmlTask.locator('text').evaluate((element) => {
          const selection = element.ownerDocument.defaultView?.getSelection();
          selection?.selectAllChildren(element);
          return selection?.toString();
        }),
      )
      .toBe('Switched diagram');
    await expect
      .poll(async () => JSON.parse(await readFile(preferencesFilePath, 'utf8')).plantUml.serverUrl)
      .toBe(newServerUrl);

    await plantUmlTask.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const diagramHeading = finishedDocument.getByRole('heading', { name: 'Diagram' });
    const headingPositionBeforeDrawer = await diagramHeading.evaluate(
      (heading) => heading.getBoundingClientRect().top,
    );
    await plantUmlTask.hover();
    const sourceAction = plantUmlTask.getByRole('button', { name: '查看图表源码' });
    const focusAction = plantUmlTask.getByRole('button', { name: '全屏查看图表' });
    await expect(sourceAction).toHaveAttribute('title', '查看图表源码');
    await expect(focusAction).toBeEnabled();
    await expect
      .poll(() =>
        plantUmlTask
          .locator('.diagram-action-toolbar')
          .evaluate((element) => getComputedStyle(element).opacity),
      )
      .toBe('1');

    await sourceAction.focus();
    await sourceAction.press('Enter');
    const sourceDrawer = readerWindow.getByRole('complementary', { name: '图表源码' });
    await expect(sourceDrawer).toBeVisible();
    await expect(readerWindow.getByRole('complementary', { name: '大纲' })).toHaveCount(0);
    await sourceDrawer.getByRole('button', { name: '复制源码' }).click();
    await expect
      .poll(() => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
      .toContain('!theme mars');
    await sourceDrawer.getByRole('button', { name: '复制 SVG' }).click();
    await expect
      .poll(() => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
      .toContain('Switched diagram');
    await sourceDrawer.getByRole('button', { name: '关闭图表源码' }).click();
    await expect(readerWindow.getByRole('complementary', { name: '大纲' })).toBeVisible();
    await expect
      .poll(() => diagramHeading.evaluate((heading) => heading.getBoundingClientRect().top))
      .toBeCloseTo(headingPositionBeforeDrawer, 0);

    await plantUmlTask.hover();
    await focusAction.click();
    const focusDialog = readerWindow.getByRole('dialog', { name: '全屏图表' });
    await expect(focusDialog).toBeVisible();
    await expect(focusDialog.locator('text')).toHaveText('Switched diagram');
    await focusDialog.getByRole('button', { name: '放大图表' }).click();
    await expect(focusDialog.getByText('120%')).toBeVisible();
    const canvas = focusDialog.getByLabel('图表全屏画布');
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('Full-screen diagram canvas is not visible.');
    await readerWindow.mouse.move(bounds.x + 20, bounds.y + 20);
    await readerWindow.mouse.down();
    await readerWindow.mouse.move(bounds.x + 90, bounds.y + 70);
    await readerWindow.mouse.up();
    await expect(focusDialog.locator('[style*="translate"]')).not.toHaveAttribute(
      'style',
      /translate\(0px, 0px\)/,
    );
    await focusDialog.getByRole('button', { name: '适应窗口' }).click();
    await expect(focusDialog.getByText('100%')).toBeVisible();
    await expect(focusDialog.locator('[style*="translate"]')).toHaveAttribute(
      'style',
      /translate\(0px, 0px\) scale\(1\)/,
    );
    await focusDialog.getByRole('button', { name: '返回文档' }).click();
    await expect(focusDialog).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('shows PlantUML source, server reason, and retry when rendering fails', async () => {
  const serverUrl = await startServer((_request, response) => {
    response.writeHead(503);
    response.end('unavailable');
  });
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-plantuml-failure-'));
  const sourceDocumentPath = join(temporaryDirectory, 'diagram.md');
  const preferencesFilePath = join(temporaryDirectory, 'reader-preferences.json');
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  await writeFile(
    sourceDocumentPath,
    '# Failure\n\n```plantuml\n@startuml\nAlice -> Bob\n@enduml\n```',
  );
  await writeFile(preferencesFilePath, JSON.stringify(createPreferences(serverUrl)));
  const electronApp = await launchDesktop(sourceDocumentPath, preferencesFilePath, sessionFilePath);

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = readerWindow.frameLocator('iframe[data-finished-document="active"]');
    const plantUmlTask = finishedDocument.locator('[data-render-task-kind="plantuml"]');
    await expect(plantUmlTask.getByText('无法呈现图表')).toBeVisible();
    await expect(plantUmlTask.locator('.render-task-error-detail')).toContainText('HTTP 503');
    await expect(plantUmlTask.locator('.render-task-error-source')).toContainText('Alice -> Bob');
    await expect(plantUmlTask.getByRole('button', { name: '重试' })).toBeVisible();
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
