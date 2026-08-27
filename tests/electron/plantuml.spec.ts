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
): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesFilePath,
      FUXIAN_E2E_SESSION_FILE: sessionFilePath,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourceDocumentPath,
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
      `<svg xmlns="http://www.w3.org/2000/svg"><text>${
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
    '# Architecture\n\n```plantuml\n@startuml\n!theme mars\nAlice -> Bob: hello\n@enduml\n```',
  );
  await writeFile(preferencesFilePath, JSON.stringify(createPreferences(oldServerUrl)));
  const electronApp = await launchDesktop(sourceDocumentPath, preferencesFilePath, sessionFilePath);

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();
    await oldRequest;
    await readerWindow.getByRole('button', { name: '设置' }).click();
    const settingsWindow = await getSettingsWindow(electronApp);
    await settingsWindow.getByRole('button', { name: 'PlantUML' }).click();
    await expect(settingsWindow.getByText('PlantUML 源码会发送到上方配置的服务。')).toBeVisible();
    await settingsWindow.getByLabel('Server 地址').fill(newServerUrl);
    await settingsWindow.getByRole('button', { name: '验证并保存' }).click();
    await expect(settingsWindow.getByText('连接成功，地址已保存。')).toBeVisible();

    const finishedDocument = readerWindow.frameLocator('iframe[title="Finished document"]');
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
    const finishedDocument = readerWindow.frameLocator('iframe[title="Finished document"]');
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
