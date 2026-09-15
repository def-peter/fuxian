import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { desktopIpcChannels } from '../../packages/shared-types/src/index';

test('the close shortcut closes one document and guards unsaved edits without closing the window', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-close-document-'));
  const paths = Array.from({ length: 10 }, (_, index) => join(directory, `document-${index}.md`));
  await Promise.all(paths.map((path, index) => writeFile(path, `# Document ${index}`)));
  const app = await electron.launch({
    executablePath: createRequire(import.meta.url)('electron') as string,
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'drafts.json'),
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify(paths),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown', exact: true }).click();
    const openItems = page.getByRole('button', { name: /^关闭“document-/ });
    await expect(openItems).toHaveCount(10);
    expect(
      await app.evaluate(
        ({ Menu }) =>
          Menu.getApplicationMenu()?.getMenuItemById('close-active-document')?.accelerator,
      ),
    ).toBe('CmdOrCtrl+W');
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect.poll(() => app.windows().length).toBe(2);
    await app.evaluate(({ Menu, BrowserWindow }) => {
      const settings = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes('view=settings'),
      )!;
      const command = Menu.getApplicationMenu()!.getMenuItemById('close-active-document')!;
      command.click(undefined as never, settings, settings.webContents);
    });
    await expect.poll(() => app.windows().length).toBe(1);
    await expect(openItems).toHaveCount(10);
    const closeCurrent = () =>
      app.evaluate(({ Menu, BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0]!;
        const command = Menu.getApplicationMenu()!.getMenuItemById('close-active-document')!;
        command.click(undefined as never, window, window.webContents);
      });
    await page.frameLocator('iframe[data-finished-document="active"]').locator('h1').click();
    await closeCurrent();
    await expect(openItems).toHaveCount(9);
    await expect.poll(() => app.windows().length).toBe(1);
    await expect
      .poll(async () => {
        const session = JSON.parse(
          await readFile(join(directory, 'session.json'), 'utf8').catch(() => '{}'),
        );
        return [session.openDocuments?.length, session.recentDocuments?.length];
      })
      .toEqual([9, 1]);

    await page.getByRole('radio', { name: '纸张预览', exact: true }).click();
    await expect(page.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 30000 });
    await closeCurrent();
    await expect(openItems).toHaveCount(8);
    await page.getByRole('button', { name: '进入编辑模式', exact: true }).click();
    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('# Unsaved');
    await closeCurrent();
    await expect(page.getByRole('dialog')).toContainText('保存对');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(openItems).toHaveCount(8);
    await closeCurrent();
    await page.getByRole('button', { name: '不保存', exact: true }).click();
    await expect(openItems).toHaveCount(7);
    for (let remaining = 6; remaining >= 0; remaining--) {
      await closeCurrent();
      await expect(openItems).toHaveCount(remaining);
    }
    await closeCurrent();
    await expect.poll(() => app.windows().length).toBe(1);
    await expect(page.getByRole('button', { name: '打开 Markdown', exact: true })).toBeVisible();
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('reloading during session restoration does not replace saved documents with an empty session', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-session-reload-'));
  const paths = Array.from({ length: 10 }, (_, index) => join(directory, `document-${index}.md`));
  await Promise.all(paths.map((path, index) => writeFile(path, `# Document ${index}`)));
  const app = await electron.launch({
    executablePath: createRequire(import.meta.url)('electron') as string,
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'drafts.json'),
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify(paths),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown', exact: true }).click();
    const openItems = page.getByRole('button', { name: /^关闭“document-/ });
    await expect(openItems).toHaveCount(10);
    await expect
      .poll(
        async () =>
          JSON.parse(await readFile(join(directory, 'session.json'), 'utf8').catch(() => '{}'))
            .openDocuments?.length,
      )
      .toBe(10);

    // Hold the first restoration at the real draft-loading IPC boundary. A second
    // reload must not persist the renderer's still-empty initial session.
    await app.evaluate(({ ipcMain }, channel) => {
      let calls = 0;
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, () => {
        if (++calls > 1) return [];
        Reflect.set(globalThis, '__sessionRestorationPending', true);
        return new Promise((resolve) => {
          Reflect.set(globalThis, '__releaseSessionRestoration', () => resolve([]));
        });
      });
    }, desktopIpcChannels.loadSourceRecoveryDrafts);
    await page.reload();
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, '__sessionRestorationPending')))
      .toBe(true);
    await expect(page.getByText('正在恢复上次会话...', { exact: true })).toBeVisible();
    await page.reload();
    await expect(openItems).toHaveCount(10);
    await app.evaluate(() => Reflect.get(globalThis, '__releaseSessionRestoration')());
    const restored = await page.evaluate(() => window.fuxian.loadDocumentSession());
    expect(restored.session.openDocuments).toHaveLength(10);
    expect(restored.session.recentDocuments).toHaveLength(0);

    const menuRoles = () =>
      app.evaluate(({ Menu }) =>
        Menu.getApplicationMenu()!.items.flatMap(
          (item) => item.submenu?.items.map((entry) => entry.role) ?? [],
        ),
      );
    expect(await menuRoles()).toEqual(expect.arrayContaining(['reload', 'forcereload']));
    // Rebuild the real menu with the packaged-app flag, without creating a visible app.
    await app.evaluate(({ app }) =>
      Object.defineProperty(app, 'isPackaged', { configurable: true, value: true }),
    );
    await page.evaluate(async () =>
      window.fuxian.saveReaderPreferences(await window.fuxian.loadReaderPreferences()),
    );
    expect(await menuRoles()).not.toEqual(expect.arrayContaining(['reload']));
    expect(await menuRoles()).not.toEqual(expect.arrayContaining(['forcereload']));
    await app.evaluate(({ app }) =>
      Object.defineProperty(app, 'isPackaged', { configurable: true, value: false }),
    );
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
