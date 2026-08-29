import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourceDocumentPath = resolve(repositoryRoot, 'fixtures/showcase.md');

const findSettingsWindow = async (electronApp: ElectronApplication): Promise<Page> => {
  await expect.poll(() => electronApp.windows().length).toBe(2);
  const settingsWindow = electronApp
    .windows()
    .find((window) => new URL(window.url()).searchParams.get('view') === 'settings');
  if (!settingsWindow) throw new Error('Settings window did not open.');
  await settingsWindow.waitForLoadState('domcontentloaded');
  return settingsWindow;
};

test('downloads an available update and flushes the reading session before install', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-update-'));
  const installMarkerPath = join(temporaryDirectory, 'install.json');
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(temporaryDirectory, 'reader-preferences.json'),
      FUXIAN_E2E_SESSION_FILE: sessionFilePath,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourceDocumentPath,
      FUXIAN_E2E_UPDATE_INSTALL_MARKER: installMarkerPath,
      FUXIAN_E2E_UPDATE_SCENARIO: 'available',
      NODE_ENV: 'test',
    },
  });

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.setViewportSize({ height: 900, width: 1_440 });
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = readerWindow.frameLocator('iframe[title="Finished document"]');
    await finishedDocument
      .getByRole('heading', { name: '本地资源' })
      .evaluate((element) => element.scrollIntoView({ block: 'start' }));

    const settingsButton = readerWindow.getByRole('button', { name: '设置，有可用更新' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    const settingsWindow = await findSettingsWindow(electronApp);
    await expect(settingsWindow.getByRole('heading', { name: '关于与更新' })).toBeVisible();
    await expect(settingsWindow.getByText('新版本 0.2.0 可用')).toBeVisible();
    await expect(
      settingsWindow.getByText('新增安全可靠的软件更新，并完善发布流程。'),
    ).toBeVisible();

    await settingsWindow.getByRole('button', { name: '下载更新' }).click();
    await expect(settingsWindow.getByText('更新已准备好')).toBeVisible();
    await settingsWindow.getByRole('button', { name: '重启并更新' }).click();

    await expect
      .poll(async () => JSON.parse(await readFile(installMarkerPath, 'utf8')))
      .toEqual({ installedVersion: '0.2.0' });
    await expect
      .poll(async () => {
        const session = JSON.parse(await readFile(sessionFilePath, 'utf8')) as {
          openDocuments: Array<{ path: string; readingPosition: { relativeProgress: number } }>;
        };
        return session.openDocuments.find(({ path }) => path === sourceDocumentPath)
          ?.readingPosition.relativeProgress;
      })
      .toBeGreaterThan(0);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('opens the matching GitHub Release for a manual macOS-style update', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-update-release-'));
  const releaseMarkerPath = join(temporaryDirectory, 'release.json');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(temporaryDirectory, 'reader-preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(temporaryDirectory, 'document-session.json'),
      FUXIAN_E2E_UPDATE_DELIVERY: 'release-page',
      FUXIAN_E2E_UPDATE_RELEASE_MARKER: releaseMarkerPath,
      FUXIAN_E2E_UPDATE_SCENARIO: 'available',
      NODE_ENV: 'test',
    },
  });

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.getByRole('button', { name: '设置，有可用更新' }).click();
    const settingsWindow = await findSettingsWindow(electronApp);

    await expect(settingsWindow.getByText('新版本 0.2.0 可用')).toBeVisible();
    await settingsWindow.getByRole('button', { name: '前往 GitHub Release' }).click();

    await expect
      .poll(async () => JSON.parse(await readFile(releaseMarkerPath, 'utf8')))
      .toEqual({ version: '0.2.0' });
    await expect(settingsWindow.getByRole('button', { name: '下载更新' })).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
