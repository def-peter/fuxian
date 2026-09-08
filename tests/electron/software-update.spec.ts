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
  const updateStateFilePath = join(temporaryDirectory, 'app-update-state.json');
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
      FUXIAN_E2E_UPDATE_STATE_FILE: updateStateFilePath,
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
    const finishedDocument = readerWindow.frameLocator('iframe[data-finished-document="active"]');
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
    const updateReminder = readerWindow.getByRole('alert').filter({ hasText: '新版本 0.2.0 可用' });
    await expect(updateReminder).toBeVisible();
    await updateReminder.getByRole('button', { name: '查看更新' }).click();
    await expect(updateReminder).toHaveCount(0);
    await expect
      .poll(() => readJsonIfAvailable(updateStateFilePath))
      .toEqual({
        lastNotifiedVersion: '0.2.0',
        version: 1,
      });

    const settingsWindow = await findSettingsWindow(electronApp);
    await expect(settingsWindow.getByRole('heading', { name: '关于与更新' })).toBeVisible();
    await expect(settingsWindow.getByText('新版本 0.2.0 可用')).toBeVisible();
    const releaseNotes = settingsWindow.getByTestId('update-notes-content');
    await expect(releaseNotes).toContainText('新增安全可靠的软件更新，并完善发布流程。');
    await expect(releaseNotes.getByRole('listitem')).toHaveText('修复 HTML 标签显示。');
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

for (const locale of ['zh-CN', 'en-US']) {
  test(`downloads a manual macOS installer and keeps the GitHub fallback available (${locale})`, async () => {
    const label = (zh: string, en: string): string => (locale === 'zh-CN' ? zh : en);
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-update-release-'));
    const releaseMarkerPath = join(temporaryDirectory, 'release.json');
    const installMarkerPath = join(temporaryDirectory, 'install.json');
    const electronApp = await electron.launch({
      executablePath: electronPath,
      args: [desktopAppPath],
      env: {
        ...process.env,
        FUXIAN_E2E_PREFERENCES_FILE: join(temporaryDirectory, 'reader-preferences.json'),
        FUXIAN_E2E_SESSION_FILE: join(temporaryDirectory, 'document-session.json'),
        FUXIAN_E2E_UPDATE_DELIVERY: 'manual-install',
        FUXIAN_E2E_SYSTEM_LOCALE: locale,
        FUXIAN_E2E_UPDATE_INSTALL_MARKER: installMarkerPath,
        FUXIAN_E2E_UPDATE_RELEASE_MARKER: releaseMarkerPath,
        FUXIAN_E2E_UPDATE_SCENARIO: 'available',
        FUXIAN_E2E_UPDATE_NOTES: `<h2>What is new</h2><ul>${'<li>Resume interrupted downloads and open the verified installer.</li>'.repeat(20)}</ul><details><summary>中文更新日志</summary><h2>本次更新</h2><ul>${'<li>支持断点续传，下载完成后打开经过校验的安装包。</li>'.repeat(20)}</ul></details>`,
        NODE_ENV: 'test',
      },
    });

    try {
      const readerWindow = await electronApp.firstWindow();
      await readerWindow
        .getByRole('button', { name: label('设置，有可用更新', 'Settings, update available') })
        .click();
      const settingsWindow = await findSettingsWindow(electronApp);

      const notes = settingsWindow.getByTestId('update-notes-content');
      await expect(notes).toContainText(label('支持断点续传', 'Resume interrupted downloads'));
      await expect(notes).not.toContainText(label('What is new', '本次更新'));
      const notesViewport = notes.locator('xpath=ancestor::*[@data-slot="scroll-area-viewport"]');
      await expect
        .poll(() =>
          notesViewport.evaluate((element) => element.scrollHeight > element.clientHeight),
        )
        .toBe(true);
      const download = settingsWindow.getByRole('button', {
        name: label('下载更新', 'Download update'),
      });
      for (const [width, height] of [
        [1100, 850],
        [900, 650],
      ]) {
        await electronApp.evaluate(
          ({ BrowserWindow }, bounds) => {
            BrowserWindow.getAllWindows()
              .find((window) => window.webContents.getURL().includes('view=settings'))
              ?.setBounds(bounds);
          },
          { width, height },
        );
        await expect(download).toBeInViewport();
        const buttonBounds = await download.boundingBox();
        const notesBounds = await notesViewport.boundingBox();
        expect(buttonBounds!.y + buttonBounds!.height).toBeLessThan(notesBounds!.y);
        expect(notesBounds!.height).toBeLessThanOrEqual(257);
        expect(
          await notesViewport.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true);
        await settingsWindow.screenshot({
          path: test.info().outputPath(`release-notes-${locale}-${width}.png`),
        });
      }
      await settingsWindow
        .getByRole('button', { name: label('查看完整更新日志', 'View full release notes') })
        .hover();
      await expect(settingsWindow.getByRole('tooltip')).toHaveText(
        label('查看完整更新日志', 'View full release notes'),
      );
      await notesViewport.evaluate((element) => {
        element.scrollTop = 100;
      });
      await expect
        .poll(() => notesViewport.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0);
      await settingsWindow
        .getByRole('button', { name: label('查看完整更新日志', 'View full release notes') })
        .click();
      await expect.poll(() => readJsonIfAvailable(releaseMarkerPath)).toEqual({ version: '0.2.0' });

      await expect(
        settingsWindow.getByRole('button', { name: label('下载更新', 'Download update') }),
      ).toBeVisible();
      await settingsWindow
        .getByRole('button', { name: label('在 GitHub 下载', 'Download on GitHub') })
        .click();

      await expect.poll(() => readJsonIfAvailable(releaseMarkerPath)).toEqual({ version: '0.2.0' });
      await settingsWindow
        .getByRole('button', { name: label('下载更新', 'Download update') })
        .click();
      await expect(
        settingsWindow.getByRole('button', { name: label('重启并更新', 'Restart and Update') }),
      ).toHaveCount(0);
      await settingsWindow
        .getByRole('button', { name: label('打开安装包', 'Open Installer') })
        .click();
      await expect
        .poll(() => readJsonIfAvailable(installMarkerPath))
        .toEqual({ installedVersion: '0.2.0' });
      await expect(
        settingsWindow.getByRole('button', { name: label('在 GitHub 下载', 'Download on GitHub') }),
      ).toBeVisible();
      await settingsWindow.screenshot({ path: test.info().outputPath('manual-update.png') });
    } finally {
      await electronApp.close();
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
}

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
