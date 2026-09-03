import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourceDocumentPath = resolve(repositoryRoot, 'fixtures/showcase.md');

const readJsonIfAvailable = async <Value>(path: string): Promise<Value | undefined> => {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Value;
  } catch {
    return undefined;
  }
};

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
    await readerWindow
      .getByRole('complementary', { name: '大纲' })
      .getByRole('button', { name: '本地资源' })
      .click();
    const finishedDocument = readerWindow.frameLocator('iframe[title="Finished document"]');
    await expect
      .poll(() =>
        finishedDocument
          .getByRole('heading', { name: '本地资源' })
          .evaluate((heading) => Math.round(heading.getBoundingClientRect().top)),
      )
      .toBeLessThan(40);
    await expect
      .poll(async () => {
        const session = await readJsonIfAvailable<{
          openDocuments: Array<{
            path: string;
            readingPosition: { relativeProgress: number };
          }>;
        }>(sessionFilePath);
        return session?.openDocuments.find(({ path }) => path === sourceDocumentPath)
          ?.readingPosition.relativeProgress;
      })
      .toBeGreaterThan(0);

    const settingsButton = readerWindow.getByRole('button', { name: '设置，有可用更新' });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();

    const settingsWindow = await findSettingsWindow(electronApp);
    await expect(settingsWindow.getByRole('heading', { name: '关于与更新' })).toBeVisible();
    await expect(settingsWindow.getByText('新版本 0.2.0 可用')).toBeVisible();
    const releaseNotes = settingsWindow
      .getByRole('heading', { name: '更新内容' })
      .locator('..')
      .locator('p');
    await expect(releaseNotes).toHaveText(
      '新增安全可靠的软件更新，并完善发布流程。\n\n- 修复 HTML 标签显示。',
    );
    expect(await releaseNotes.textContent()).not.toMatch(/<\/?[a-z]/iu);

    await settingsWindow.getByRole('button', { name: '下载更新' }).click();
    await expect(settingsWindow.getByText('更新已准备好')).toBeVisible();
    await settingsWindow.getByRole('button', { name: '重启并更新' }).click();

    await expect
      .poll(() => readJsonIfAvailable(installMarkerPath))
      .toEqual({
        installedVersion: '0.2.0',
      });
    await expect
      .poll(async () => {
        const session = await readJsonIfAvailable<{
          openDocuments: Array<{ path: string; readingPosition: { relativeProgress: number } }>;
        }>(sessionFilePath);
        return session?.openDocuments.find(({ path }) => path === sourceDocumentPath)
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

    await expect.poll(() => readJsonIfAvailable(releaseMarkerPath)).toEqual({ version: '0.2.0' });
    await expect(settingsWindow.getByRole('button', { name: '下载更新' })).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('requires a decision about unsaved source changes before installing an update', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-update-source-'));
  const installMarkerPath = join(temporaryDirectory, 'install.json');
  const sourcePath = join(temporaryDirectory, 'guide.md');
  await writeFile(sourcePath, '# Saved', 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(temporaryDirectory, 'reader-preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(temporaryDirectory, 'document-session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(temporaryDirectory, 'source-recovery-drafts.json'),
      FUXIAN_E2E_UPDATE_INSTALL_MARKER: installMarkerPath,
      FUXIAN_E2E_UPDATE_SCENARIO: 'available',
      NODE_ENV: 'test',
    },
  });

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();
    await readerWindow.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = readerWindow.locator('.cm-content');
    await editor.click();
    await readerWindow.keyboard.press('ControlOrMeta+A');
    await readerWindow.keyboard.insertText('# Unsaved');

    await readerWindow.getByRole('button', { name: '设置，有可用更新' }).click();
    const settingsWindow = await findSettingsWindow(electronApp);
    await settingsWindow.getByRole('button', { name: '下载更新' }).click();
    await expect(settingsWindow.getByText('更新已准备好')).toBeVisible();
    await settingsWindow.getByRole('button', { name: '重启并更新' }).click();

    await expect(readerWindow.getByRole('dialog')).toContainText('保存对“guide.md”的修改？');
    await readerWindow.getByRole('button', { name: '取消', exact: true }).click();
    await expect.poll(() => readJsonIfAvailable(installMarkerPath)).toBeUndefined();
    await expect(settingsWindow.getByText('暂时无法重启安装，请稍后重试。')).toBeVisible();

    await settingsWindow.getByRole('button', { name: '重启并更新' }).click();
    await readerWindow.getByRole('button', { name: '不保存', exact: true }).click();
    await expect
      .poll(() => readJsonIfAvailable(installMarkerPath))
      .toEqual({
        installedVersion: '0.2.0',
      });
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe('# Saved');
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
