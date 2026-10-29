import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultReaderPreferences } from '../../packages/shared-types/src/index';
import { captureElectronWindow } from './capture-window';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

const launch = (directory: string, closeGuard = false): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'drafts.json'),
      ...(closeGuard ? { FUXIAN_E2E_SOURCE_CLOSE_GUARD: '1' } : {}),
      NODE_ENV: 'test',
    },
  });

interface SaveDialogState {
  defaults: Array<string | undefined>;
  destinations: Array<string | null>;
}

const stubSaveDialogs = async (
  app: ElectronApplication,
  destinations: Array<string | null>,
): Promise<void> => {
  await app.evaluate(({ dialog }, choices) => {
    const state: SaveDialogState = { defaults: [], destinations: choices };
    Object.assign(globalThis, { fuxianSaveDialogTest: state });
    dialog.showSaveDialog = (async (_owner: unknown, options: { defaultPath?: string }) => {
      state.defaults.push(options.defaultPath);
      const filePath = state.destinations.shift();
      return { canceled: !filePath, filePath: filePath ?? undefined };
    }) as typeof dialog.showSaveDialog;
  }, destinations);
};

const dialogDefaults = (app: ElectronApplication): Promise<Array<string | undefined>> =>
  app.evaluate(
    () =>
      (globalThis as unknown as { fuxianSaveDialogTest: SaveDialogState }).fuxianSaveDialogTest
        .defaults,
  );

for (const appearance of ['light', 'dark'] as const) {
  test(`keeps the start-view secondary action opaque, flat, and keyboard accessible in ${appearance} mode`, async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-start-actions-')));
    await writeFile(
      join(directory, 'preferences.json'),
      JSON.stringify({ ...createDefaultReaderPreferences(), appearance }),
      'utf8',
    );
    const app = await launch(directory);
    try {
      const page = await app.firstWindow();
      await page.setViewportSize({ width: 1_200, height: 800 });
      const newButton = page.getByRole('main').getByRole('button', { name: '新建 Markdown' });
      const openButton = page.getByRole('main').getByRole('button', { name: '打开 Markdown' });
      await expect(newButton).toBeEnabled();
      await expect(newButton).toHaveCSS(
        'background-color',
        appearance === 'light' ? 'rgb(255, 255, 255)' : 'rgb(33, 36, 40)',
      );
      await expect(newButton).toHaveCSS('box-shadow', 'none');
      await expect(newButton).toHaveCSS('border-top-width', '1px');
      await expect(newButton).toHaveCSS('height', '40px');
      await expect(openButton).toHaveCSS(
        'background-color',
        appearance === 'light' ? 'rgb(41, 45, 50)' : 'rgb(220, 225, 229)',
      );
      await expect(
        page
          .getByRole('complementary', { name: '文档会话' })
          .getByRole('button', { name: '新建 Markdown' }),
      ).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await captureElectronWindow(
        app,
        page,
        test.info().outputPath(`start-view-${appearance}.png`),
      );

      await newButton.hover();
      await expect(newButton).toHaveCSS(
        'background-color',
        appearance === 'light' ? 'rgb(255, 255, 255)' : 'rgb(33, 36, 40)',
      );
      await expect(newButton).toHaveCSS(
        'border-top-color',
        appearance === 'light' ? 'rgb(139, 150, 159)' : 'rgb(94, 102, 112)',
      );
      await captureElectronWindow(
        app,
        page,
        test.info().outputPath(`start-view-hover-${appearance}.png`),
      );
      await openButton.focus();
      await page.keyboard.press('Tab');
      await expect(newButton).toBeFocused();
      await expect(newButton).not.toHaveCSS('box-shadow', 'none');
      await captureElectronWindow(
        app,
        page,
        test.info().outputPath(`start-view-focus-${appearance}.png`),
      );
      await page.keyboard.press('Enter');
      await expect(page.locator('.cm-content')).toBeFocused();
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test(`keeps unsaved-dialog secondary actions solid at rest and on hover in ${appearance} mode`, async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-unsaved-actions-')));
    await writeFile(
      join(directory, 'preferences.json'),
      JSON.stringify({ ...createDefaultReaderPreferences(), appearance }),
      'utf8',
    );
    const app = await launch(directory);
    try {
      const page = await app.firstWindow();
      await page.setViewportSize({ width: 1_200, height: 800 });
      await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
      await expect(page.locator('.cm-content')).toBeFocused();
      await page.keyboard.insertText('# Unsaved document');
      await page.getByRole('button', { name: '进入阅读模式' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('保存对“未命名”的修改？');
      await expect(dialog).toHaveAccessibleDescription('如果不保存，当前修改将会丢失。');
      const panelColor = appearance === 'light' ? 'rgb(255, 255, 255)' : 'rgb(33, 36, 40)';
      const hoverBorder = appearance === 'light' ? 'rgb(139, 150, 159)' : 'rgb(94, 102, 112)';
      for (const name of ['取消', '不保存']) {
        const button = dialog.getByRole('button', { name, exact: true });
        await expect(button).toHaveCSS('background-color', panelColor);
        await expect(button).toHaveCSS('box-shadow', 'none');
        await expect(button).toHaveCSS('border-top-width', '1px');
      }
      await expect(dialog.getByRole('button', { name: '保存', exact: true })).toHaveCSS(
        'background-color',
        appearance === 'light' ? 'rgb(41, 45, 50)' : 'rgb(220, 225, 229)',
      );
      await captureElectronWindow(
        app,
        page,
        test.info().outputPath(`unsaved-normal-${appearance}.png`),
      );
      for (const [index, name] of ['取消', '不保存'].entries()) {
        const button = dialog.getByRole('button', { name, exact: true });
        await button.hover();
        await expect(button).toHaveCSS('background-color', panelColor);
        await expect(button).toHaveCSS('border-top-color', hoverBorder);
        await captureElectronWindow(
          app,
          page,
          test.info().outputPath(`unsaved-hover-${index}-${appearance}.png`),
        );
      }
      await dialog.getByRole('button', { name: '取消', exact: true }).focus();
      await page.keyboard.press('Tab');
      const discard = dialog.getByRole('button', { name: '不保存', exact: true });
      await expect(discard).toBeFocused();
      await expect(discard).toHaveCSS('background-color', panelColor);
      await expect(discard).not.toHaveCSS('box-shadow', 'none');
      await captureElectronWindow(
        app,
        page,
        test.info().outputPath(`unsaved-focus-${appearance}.png`),
      );
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('.cm-content')).toContainText('# Unsaved document');
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test(`keeps external-conflict secondary actions solid on hover in ${appearance} mode`, async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-conflict-actions-')));
    const sourcePath = join(directory, 'conflict.md');
    await writeFile(
      join(directory, 'preferences.json'),
      JSON.stringify({ ...createDefaultReaderPreferences(), appearance }),
      'utf8',
    );
    const app = await launch(directory);
    try {
      await stubSaveDialogs(app, [sourcePath]);
      const page = await app.firstWindow();
      await page.setViewportSize({ width: 1_200, height: 800 });
      await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
      await expect(page.locator('.cm-content')).toBeFocused();
      await page.keyboard.insertText('# Saved version');
      await page.getByRole('button', { name: '保存 Markdown' }).click();
      await expect(page.getByText('已保存', { exact: true })).toBeVisible();
      await page.locator('.cm-content').click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.insertText('# Local version');
      await writeFile(sourcePath, '# External version', 'utf8');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toContainText('“conflict.md”已在外部修改', { timeout: 15_000 });
      const panelColor = appearance === 'light' ? 'rgb(255, 255, 255)' : 'rgb(33, 36, 40)';
      for (const name of ['采用磁盘版本', '另存为']) {
        const button = dialog.getByRole('button', { name, exact: true });
        await expect(button).toHaveCSS('background-color', panelColor);
        await expect(button).toHaveCSS('box-shadow', 'none');
        await button.hover();
        await expect(button).toHaveCSS('background-color', panelColor);
        await expect(button).toHaveCSS(
          'border-top-color',
          appearance === 'light' ? 'rgb(139, 150, 159)' : 'rgb(94, 102, 112)',
        );
      }
      await captureElectronWindow(
        app,
        page,
        test.info().outputPath(`conflict-hover-${appearance}.png`),
      );
      await dialog.getByRole('button', { name: '保留本地修改' }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('.cm-content')).toContainText('# Local version');
      expect(await readFile(sourcePath, 'utf8')).toBe('# External version');
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test('creates focused untitled documents from the start view, sidebar, shortcut, and native menu without creating files', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-new-document-')));
  const app = await launch(directory);
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1_200, height: 800 });
    await expect(
      page.getByRole('main').getByRole('button', { name: '新建 Markdown' }),
    ).toBeVisible();
    await captureElectronWindow(app, page, test.info().outputPath('start-view.png'));
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(page.locator('.cm-content')).toHaveText('');
    await expect(page.getByText('未保存', { exact: true })).toBeVisible();
    await captureElectronWindow(app, page, test.info().outputPath('new-markdown.png'));
    expect((await readdir(directory)).filter((name) => /\.md$/i.test(name))).toEqual([]);

    const sidebar = page.getByRole('complementary', { name: '文档会话' });
    await expect(sidebar.getByRole('button', { name: '未命名', exact: true })).toBeVisible();
    await sidebar.getByRole('button', { name: '关闭“未命名”', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('main').getByRole('button', { name: '打开 Markdown', exact: true }),
    ).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '未命名', exact: true })).toHaveCount(0);

    await sidebar.getByRole('button', { name: '新建 Markdown' }).click();
    await page.keyboard.press('ControlOrMeta+n');
    await expect(sidebar.getByRole('button', { name: '未命名 2', exact: true })).toBeVisible();
    await app.evaluate(({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      const command = menu?.items
        .flatMap((item) => item.submenu?.items ?? [])
        .find((item) => item.accelerator === 'CmdOrCtrl+N');
      if (!command) throw new Error('New Markdown menu command is missing');
      command.click();
    });
    await expect(sidebar.getByRole('button', { name: '未命名 3', exact: true })).toBeVisible();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect((await readdir(directory)).filter((name) => /\.md$/i.test(name))).toEqual([]);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('saves existing documents in place from the toolbar, shortcut, and unsaved-changes guard without choosing a path', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-existing-save-')));
  const sourcePath = join(directory, 'existing.md');
  await writeFile(sourcePath, '# Original', 'utf8');
  const app = await launch(directory);
  try {
    await stubSaveDialogs(app, []);
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [path],
      })) as typeof dialog.showOpenDialog;
    }, sourcePath);
    const page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');

    // Exercise a stale baseline through the real save IPC without waiting for a watcher.
    const conflict = await page.evaluate(
      (path) =>
        window.fuxian.saveSourceDocument({
          path,
          expectedSource: '# Stale baseline',
          source: '# Must not overwrite',
        }),
      sourcePath,
    );
    expect(conflict).toMatchObject({
      document: { path: sourcePath, source: '# Original' },
      status: 'conflict',
    });
    expect(await dialogDefaults(app)).toEqual([]);
    expect(await readFile(sourcePath, 'utf8')).toBe('# Original');

    for (const action of ['toolbar', 'shortcut', 'close'] as const) {
      const source = `# Saved via ${action}`;
      await editor.click();
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.insertText(source);
      if (action === 'toolbar') {
        await page.getByRole('button', { name: '保存 Markdown' }).click();
      } else if (action === 'shortcut') {
        await page.keyboard.press('ControlOrMeta+s');
      } else {
        await page
          .getByRole('complementary', { name: '文档会话' })
          .getByRole('button', { name: '关闭“existing.md”', exact: true })
          .click();
        await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
      }
      await expect
        .poll(async () => ({
          dialogs: await dialogDefaults(app),
          source: await readFile(sourcePath, 'utf8'),
        }))
        .toEqual({ dialogs: [], source });
      if (action !== 'close') {
        await expect(page.getByText('已保存', { exact: true })).toBeVisible();
      }
    }
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('main').getByRole('button', { name: '打开 Markdown', exact: true }),
    ).toBeVisible();
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('chooses a path only for the first untitled save, preserves canceled edits, and saves subsequent edits in place', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-new-save-')));
  const firstPath = join(directory, 'first.md');
  const app = await launch(directory);
  try {
    await stubSaveDialogs(app, [null, firstPath]);
    const page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.insertText('# First version');
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('未保存', { exact: true })).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('# First version');
    expect((await readdir(directory)).filter((name) => /\.md$/i.test(name))).toEqual([]);
    expect((await dialogDefaults(app))[0]).toMatch(/未命名\.md$/);

    await page.getByRole('button', { name: '保存 Markdown' }).click();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    expect(await readFile(firstPath, 'utf8')).toBe('# First version');

    await page.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('# Second version');
    await page.keyboard.press('ControlOrMeta+s');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    expect(await readFile(firstPath, 'utf8')).toBe('# Second version');

    // Saving again without edits must not turn Save into Save As.
    await page.getByRole('button', { name: '保存 Markdown' }).click();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    expect(await dialogDefaults(app)).toEqual([
      expect.stringMatching(/未命名\.md$/),
      expect.stringMatching(/未命名\.md$/),
    ]);
    await page.getByRole('button', { name: '进入阅读模式' }).click();
    await expect(
      page
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'Second version' }),
    ).toBeVisible();
    const sidebar = page.getByRole('complementary', { name: '文档会话' });
    await expect(sidebar.getByRole('button', { name: 'first.md', exact: true })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '未命名', exact: true })).toHaveCount(0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('guards new and close actions, keeps canceled saves, and closes the saved identity after choosing Save', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-new-guard-')));
  const savedPath = join(directory, 'saved-on-close.md');
  const app = await launch(directory);
  try {
    await stubSaveDialogs(app, [null, savedPath]);
    const page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.insertText('# Keep me');
    await page.keyboard.press('ControlOrMeta+n');
    await expect(page.getByRole('dialog')).toContainText('保存对“未命名”的修改？');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText('# Keep me');

    const sidebar = page.getByRole('complementary', { name: '文档会话' });
    await sidebar.getByRole('button', { name: '关闭“未命名”', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('保存对“未命名”的修改？');
    await expect(page.locator('.cm-content')).toContainText('# Keep me');
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('main').getByRole('button', { name: '打开 Markdown', exact: true }),
    ).toBeVisible();
    expect(await readFile(savedPath, 'utf8')).toBe('# Keep me');
    await expect(
      sidebar.getByRole('button', { name: 'saved-on-close.md', exact: true }),
    ).toBeVisible();
    await expect(sidebar.getByRole('button', { name: '未命名', exact: true })).toHaveCount(0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('recovers an untitled document after a crash without creating a Markdown file', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-untitled-recovery-')));
  let app = await launch(directory);
  try {
    let page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.insertText('# Recover this\n\nUnsaved content.');
    await expect
      .poll(async () => {
        try {
          return JSON.parse(await readFile(join(directory, 'drafts.json'), 'utf8'));
        } catch {
          return undefined;
        }
      })
      .toMatchObject({
        drafts: [
          {
            path: expect.stringMatching(/^untitled:/),
            source: '# Recover this\n\nUnsaved content.',
          },
        ],
      });
    const exited = new Promise<void>((resolveExit) =>
      app.process().once('exit', () => resolveExit()),
    );
    app.process().kill('SIGKILL');
    await exited;
    app = await launch(directory);
    page = await app.firstWindow();
    await expect(page.locator('.cm-content')).toContainText('# Recover this');
    await expect(page.getByText('已恢复草稿 · 未保存', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('complementary', { name: '文档会话' })
        .getByRole('button', { name: '未命名', exact: true }),
    ).toBeVisible();
    expect((await readdir(directory)).filter((name) => /\.md$/i.test(name))).toEqual([]);
    await page.keyboard.press('ControlOrMeta+n');
    await page.getByRole('dialog').getByRole('button', { name: '不保存', exact: true }).click();
    await expect(page.locator('.cm-content')).toHaveText('');
    await expect
      .poll(async () => JSON.parse(await readFile(join(directory, 'drafts.json'), 'utf8')))
      .toMatchObject({ drafts: [] });
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('guards quitting an untitled document and keeps its content when the reader cancels', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-untitled-quit-')));
  const app = await launch(directory, true);
  let exited = false;
  const exit = new Promise<void>((resolveExit) =>
    app.process().once('exit', () => {
      exited = true;
      resolveExit();
    }),
  );
  try {
    const page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.keyboard.insertText('# Unsaved');
    await app.evaluate(({ app }) => app.quit());
    await expect(page.getByRole('dialog')).toHaveAccessibleDescription(
      '如果不保存，当前修改将会丢失。',
    );
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText('# Unsaved');
    expect(exited).toBe(false);
    await app.evaluate(({ app }) => app.quit());
    await Promise.all([exit, page.getByRole('button', { name: '不保存', exact: true }).click()]);
    expect((await readdir(directory)).filter((name) => /\.md$/i.test(name))).toEqual([]);
  } finally {
    if (!exited) {
      app.process().kill('SIGKILL');
      await exit;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test('can explicitly save an empty Markdown document and then enter reading', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-empty-save-')));
  const savedPath = join(directory, 'empty.md');
  const app = await launch(directory);
  try {
    await stubSaveDialogs(app, [savedPath]);
    const page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await page.getByRole('button', { name: '保存 Markdown' }).click();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    expect(await readFile(savedPath, 'utf8')).toBe('');
    await page.getByRole('button', { name: '进入阅读模式' }).click();
    await expect(page.locator('iframe[data-finished-document="active"]')).toBeVisible();
    await expect(page.locator('.cm-content')).toHaveCount(0);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('opens a saved document from a blank untitled document and restores the blank editor when switching back', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-new-open-')));
  const sourcePath = join(directory, 'existing.md');
  await writeFile(sourcePath, '# Existing document', 'utf8');
  const app = await launch(directory);
  try {
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = (async () => ({
        canceled: false,
        filePaths: [path],
      })) as typeof dialog.showOpenDialog;
    }, sourcePath);
    const page = await app.firstWindow();
    await page.getByRole('main').getByRole('button', { name: '新建 Markdown' }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    const sidebar = page.getByRole('complementary', { name: '文档会话' });
    await sidebar.getByRole('button', { name: '打开文档', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'Existing document' }),
    ).toBeVisible();
    await expect(page.locator('.cm-content')).toHaveCount(0);

    await sidebar.getByRole('button', { name: '未命名', exact: true }).click();
    await expect(page.locator('.cm-content')).toBeFocused();
    await expect(page.locator('.cm-content')).toHaveText('');
    expect(await readFile(sourcePath, 'utf8')).toBe('# Existing document');
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('restores multiple untitled drafts and guards each one when switching and quitting', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-multiple-drafts-')));
  const savedPath = join(directory, 'first-recovered.md');
  const updatedAt = Date.now();
  const drafts = ['First', 'Second'].map((name, index) => ({
    baselineSource: '',
    name,
    path: `untitled:33edcdd0-e014-4f6c-b130-589d6173ea0${index + 1}`,
    selection: { anchor: 0, head: 0 },
    source: `# ${name}`,
    updatedAt: updatedAt - index,
    version: 1,
  }));
  await writeFile(join(directory, 'drafts.json'), JSON.stringify({ drafts, version: 1 }), 'utf8');
  const app = await launch(directory, true);
  let exited = false;
  const exit = new Promise<void>((resolveExit) =>
    app.process().once('exit', () => {
      exited = true;
      resolveExit();
    }),
  );
  try {
    await stubSaveDialogs(app, [savedPath]);
    const page = await app.firstWindow();
    await expect(page.locator('.cm-content')).toContainText('# First');
    const sidebar = page.getByRole('complementary', { name: '文档会话' });
    await sidebar.getByRole('button', { name: 'Second', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('保存对“First”的修改？');
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText('# First');

    await sidebar.getByRole('button', { name: 'Second', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.cm-content')).toContainText('# Second');
    expect(await readFile(savedPath, 'utf8')).toBe('# First');
    await expect
      .poll(async () => JSON.parse(await readFile(join(directory, 'drafts.json'), 'utf8')))
      .toMatchObject({ drafts: [{ name: 'Second', source: '# Second' }] });

    await app.evaluate(({ app }) => app.quit());
    await expect(page.getByRole('dialog')).toContainText('保存对“Second”的修改？');
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('.cm-content')).toContainText('# Second');
    await app.evaluate(({ app }) => app.quit());
    await Promise.all([
      exit,
      page.getByRole('dialog').getByRole('button', { name: '不保存', exact: true }).click(),
    ]);
    expect(await readFile(savedPath, 'utf8')).toBe('# First');
  } finally {
    if (!exited) {
      app.process().kill('SIGKILL');
      await exit;
    }
    await rm(directory, { recursive: true, force: true });
  }
});
