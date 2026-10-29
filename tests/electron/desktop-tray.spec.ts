import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import type { Menu } from 'electron';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDefaultReaderPreferences,
  type UiLocale,
} from '../../packages/shared-types/src/index';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

interface TestTrayState {
  ready: Promise<void>;
  error?: string;
  trays: Array<{ destroyed: boolean; menu: Menu; tooltip: string; emit(event: string): void }>;
}

const closeApp = async (app: ElectronApplication): Promise<void> => {
  if (app.windows().length > 0) {
    await app.evaluate(({ BrowserWindow }) => {
      // Assertions are finished; a remaining dirty draft must not block test cleanup.
      for (const window of BrowserWindow.getAllWindows()) window.removeAllListeners('close');
    });
  }
  // On Windows, killing app.process() can kill only Playwright's launch shell.
  await app.close();
};

const removeDirectory = (directory: string): Promise<void> =>
  rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

const launch = async (
  directory: string,
  locale: UiLocale,
  initialCommand?: 'tray-new',
): Promise<ElectronApplication> => {
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: 'fuxian-tray-test',
      version: '0.0.0',
      main: resolve(repositoryRoot, 'tests/electron/fixtures/tray-main.mjs'),
    }),
  );
  await writeFile(
    join(directory, 'preferences.json'),
    JSON.stringify({
      ...createDefaultReaderPreferences(),
      language: locale,
    }),
  );
  const app = await electron.launch({
    executablePath: electronPath,
    args: [directory],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'drafts.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: join(directory, 'existing.md'),
      FUXIAN_E2E_SOURCE_CLOSE_GUARD: '1',
      FUXIAN_E2E_TRAY: '1',
      FUXIAN_E2E_TRAY_EXIT_MARKER: join(directory, 'tray-exit.json'),
      ...(initialCommand ? { FUXIAN_E2E_TRAY_INITIAL_COMMAND: initialCommand } : {}),
      NODE_ENV: 'test',
    },
  });
  try {
    await app.evaluate(async () => {
      const state = (globalThis as unknown as { fuxianTrayTest: TestTrayState }).fuxianTrayTest;
      await state.ready;
      if (state.error) throw new Error(state.error);
    });
    return app;
  } catch (error) {
    await closeApp(app);
    throw error;
  }
};

const clickTrayItem = async (app: ElectronApplication, id: string): Promise<void> => {
  await app.evaluate((_electron, itemId) => {
    const state = (globalThis as unknown as { fuxianTrayTest: TestTrayState }).fuxianTrayTest;
    const item = state.trays[0]?.menu.getMenuItemById(itemId);
    if (!item) throw new Error(`Tray command ${itemId} is missing`);
    item.click();
  }, id);
};

const traySnapshot = (app: ElectronApplication) =>
  app.evaluate(() => {
    const state = (globalThis as unknown as { fuxianTrayTest: TestTrayState }).fuxianTrayTest;
    return state.trays.map((tray) => ({
      destroyed: tray.destroyed,
      tooltip: tray.tooltip,
      labels: tray.menu.items.filter((item) => item.id).map((item) => item.label),
    }));
  });

const mainPage = async (app: ElectronApplication): Promise<Page> => {
  await expect
    .poll(() =>
      app
        .windows()
        .some((page) => page.url() !== 'about:blank' && !page.url().includes('view=settings')),
    )
    .toBe(true);
  const page = app.windows().find((page) => !page.url().includes('view=settings'))!;
  await page.waitForLoadState('domcontentloaded');
  return page;
};

test.beforeEach(() => {
  test.skip(
    process.platform !== 'darwin' && process.platform !== 'win32',
    'Desktop tray targets macOS and Windows.',
  );
});

for (const locale of ['zh-CN', 'en-US'] as const) {
  test(`tray commands use the document guards, update language, and clean up only after a confirmed quit (${locale})`, async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-tray-')));
    const sourcePath = join(directory, 'existing.md');
    await writeFile(sourcePath, '# Existing document', 'utf8');
    const app = await launch(directory, locale);
    let exited = false;
    const exit = new Promise<void>((resolveExit) =>
      app.process().once('exit', () => {
        exited = true;
        resolveExit();
      }),
    );
    const copy =
      locale === 'zh-CN'
        ? {
            tooltip: '浮现',
            labels: ['显示主窗口', '新建 Markdown', '打开 Markdown…', '设置…', '退出浮现'],
            cancel: '取消',
            discard: '不保存',
          }
        : {
            tooltip: 'Fuxian',
            labels: [
              'Show Main Window',
              'New Markdown',
              'Open Markdown…',
              'Settings…',
              'Quit Fuxian',
            ],
            cancel: 'Cancel',
            discard: 'Don’t Save',
          };
    try {
      const page = await app.firstWindow();
      await expect
        .poll(() => traySnapshot(app))
        .toEqual([{ destroyed: false, tooltip: copy.tooltip, labels: copy.labels }]);
      await clickTrayItem(app, 'tray-show');
      expect(app.windows()).toHaveLength(1);
      await clickTrayItem(app, 'tray-new');
      const editor = page.locator('.cm-content');
      await expect(editor).toBeFocused();
      await page.keyboard.insertText('# Keep this edit');
      await clickTrayItem(app, 'tray-new');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: copy.cancel, exact: true }).click();
      await expect(editor).toContainText('# Keep this edit');

      await clickTrayItem(app, 'tray-open');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: copy.discard, exact: true }).click();
      await expect(
        page
          .frameLocator('iframe[data-finished-document="active"]')
          .getByRole('heading', { name: 'Existing document' }),
      ).toBeVisible();

      await clickTrayItem(app, 'tray-settings');
      await expect.poll(() => app.windows().length).toBe(2);
      const settings = app.windows().find((page) => page.url().includes('view=settings'))!;
      await settings.waitForLoadState('domcontentloaded');
      await clickTrayItem(app, 'tray-new');
      await expect(editor).toBeFocused();
      await page.keyboard.insertText('# Keep on quit');
      await expect(editor).toContainText('# Keep on quit');
      const nextLocale = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
      await settings.evaluate(async (language) => {
        const preferences = await window.fuxian.loadReaderPreferences();
        await window.fuxian.saveReaderPreferences({ ...preferences, language });
      }, nextLocale);
      await expect
        .poll(() => traySnapshot(app))
        .toEqual([
          {
            destroyed: false,
            tooltip: locale === 'zh-CN' ? 'Fuxian' : '浮现',
            labels:
              locale === 'zh-CN'
                ? ['Show Main Window', 'New Markdown', 'Open Markdown…', 'Settings…', 'Quit Fuxian']
                : ['显示主窗口', '新建 Markdown', '打开 Markdown…', '设置…', '退出浮现'],
          },
        ]);
      await expect(editor).toContainText('# Keep on quit');
      await expect(editor).toHaveAttribute(
        'aria-label',
        nextLocale === 'en-US' ? 'Markdown source editor' : 'Markdown 源码编辑器',
      );
      await settings.evaluate(async (language) => {
        const preferences = await window.fuxian.loadReaderPreferences();
        await window.fuxian.saveReaderPreferences({ ...preferences, language });
      }, locale);
      await expect
        .poll(() => traySnapshot(app))
        .toEqual([{ destroyed: false, tooltip: copy.tooltip, labels: copy.labels }]);
      await expect(editor).toContainText('# Keep on quit');
      await editor.focus();
      await page.keyboard.press('ControlOrMeta+z');
      await expect(editor).toHaveText('');
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Shift+z' : 'Control+y');
      await expect(editor).toContainText('# Keep on quit');
      await clickTrayItem(app, 'tray-quit');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: copy.cancel, exact: true }).click();
      expect(exited).toBe(false);
      expect((await traySnapshot(app))[0]?.destroyed).toBe(false);
      await expect(editor).toContainText('# Keep on quit');
      await clickTrayItem(app, 'tray-quit');
      await Promise.all([
        exit,
        dialog.getByRole('button', { name: copy.discard, exact: true }).click(),
      ]);
      expect(JSON.parse(await readFile(join(directory, 'tray-exit.json'), 'utf8'))).toEqual({
        destroyed: [true],
      });
      expect(await readFile(sourcePath, 'utf8')).toBe('# Existing document');
    } finally {
      await closeApp(app);
      await removeDirectory(directory);
    }
  });
}

test('tray New and Open recreate a closed main window and deliver commands after restoration', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-tray-reopen-')));
  await writeFile(join(directory, 'existing.md'), '# Reopened from tray', 'utf8');
  const app = await launch(directory, 'en-US');
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Open Markdown' }),
    ).toBeVisible();
    await clickTrayItem(app, 'tray-settings');
    await expect.poll(() => app.windows().length).toBe(2);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((window) => !window.webContents.getURL().includes('view=settings'))
        ?.close();
    });
    await expect.poll(() => app.windows().length).toBe(1);

    await clickTrayItem(app, 'tray-new');
    const newPage = await mainPage(app);
    await expect(newPage.locator('.cm-content')).toBeFocused();
    await expect(newPage.locator('.cm-content')).toHaveText('');
    await expect(newPage.getByRole('dialog')).toHaveCount(0);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()
        .find((window) => !window.webContents.getURL().includes('view=settings'))
        ?.close();
    });
    await expect.poll(() => app.windows().length).toBe(1);

    await clickTrayItem(app, 'tray-open');
    const openedPage = await mainPage(app);
    await expect(
      openedPage
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'Reopened from tray' }),
    ).toBeVisible();
    expect(await traySnapshot(app)).toHaveLength(1);
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible() && !window.isFocused()),
      ),
    ).toBe(true);
  } finally {
    await closeApp(app);
    await removeDirectory(directory);
  }
});

test('tray New queued at startup guards a recovered draft instead of replacing it', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-tray-recovery-')));
  const draft = {
    baselineSource: '',
    name: 'Recovered from interruption',
    path: 'untitled:33edcdd0-e014-4f6c-b130-589d6173ea01',
    selection: { anchor: 0, head: 0 },
    source: '# Unsaved recovered content',
    updatedAt: Date.now(),
    version: 1,
  };
  await writeFile(join(directory, 'drafts.json'), JSON.stringify({ drafts: [draft], version: 1 }));
  const app = await launch(directory, 'en-US', 'tray-new');
  try {
    const page = await app.firstWindow();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Recovered from interruption');
    await expect(page.locator('.cm-content')).toContainText(draft.source);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.cm-content')).toContainText(draft.source);
    expect(JSON.parse(await readFile(join(directory, 'drafts.json'), 'utf8'))).toMatchObject({
      drafts: [{ source: draft.source }],
    });
    expect((await traySnapshot(app))[0]?.destroyed).toBe(false);
  } finally {
    await closeApp(app);
    await removeDirectory(directory);
  }
});
