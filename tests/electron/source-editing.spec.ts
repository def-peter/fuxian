import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('edits and explicitly saves Markdown before returning to the finished document', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-editing-')));
  const sourcePath = join(directory, 'guide.md');
  await writeFile(sourcePath, '# Original\n\nSaved text.', 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'source-recovery-drafts.json'),
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ height: 800, width: 1_200 });
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('# Edited\n\nLocal text.');
    await expect(page.getByText('未保存', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: '保存 Markdown' }).click();
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe('# Edited\n\nLocal text.');

    await page.getByRole('button', { name: '进入阅读模式' }).click();
    await expect(
      page.frameLocator('iframe[data-finished-document="active"]').getByRole('heading', {
        name: 'Edited',
      }),
    ).toBeVisible({ timeout: 15_000 });
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('keeps an unsaved edit and recovery draft when the source file is deleted', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-deleted-edit-')));
  const sourcePath = join(directory, 'guide.md');
  const draftsPath = join(directory, 'source-recovery-drafts.json');
  await writeFile(sourcePath, '# Original\n\nDisk content.', 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: draftsPath,
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('# Local draft\n\nUnsaved content.');
    await expect(page.getByText('未保存', { exact: true })).toBeVisible();

    await rm(sourcePath);

    await page.waitForTimeout(1_000);
    await expect(editor).toContainText('Local draft');
    await expect(
      page
        .getByRole('complementary', { name: '文档会话' })
        .getByRole('button', { exact: true, name: 'guide.md' }),
    ).toBeVisible();
    await expect
      .poll(async () => {
        try {
          return JSON.parse(await readFile(draftsPath, 'utf8')) as {
            drafts: Array<{ path: string; source: string }>;
          };
        } catch {
          return undefined;
        }
      })
      .toMatchObject({
        drafts: [{ path: sourcePath, source: expect.stringContaining('Local draft') }],
      });
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('shows an explicitly saved revision with an inline diagram failure', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-render-failure-')));
  const sourcePath = join(directory, 'diagram.md');
  const validSource = [
    '# Valid revision',
    '',
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
  ].join('\n');
  const invalidSource = [
    '# Invalid revision',
    '',
    '```mermaid',
    'this is not valid mermaid syntax !!!',
    '```',
  ].join('\n');
  await writeFile(sourcePath, validSource, 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'source-recovery-drafts.json'),
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    let finishedDocument = page.frameLocator('iframe[data-finished-document="active"]');
    await expect(
      finishedDocument.locator('[data-render-task-kind="mermaid"] .render-task-output svg'),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(invalidSource);
    await page.getByRole('button', { name: '进入阅读模式' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe(invalidSource);

    finishedDocument = page.frameLocator('iframe[data-finished-document="active"]');
    await expect(finishedDocument.getByRole('heading', { name: 'Invalid revision' })).toBeVisible({
      timeout: 15_000,
    });
    const failedDiagram = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(failedDiagram).toHaveAttribute('data-render-state', 'failed');
    await expect(failedDiagram.getByText('无法呈现图表')).toBeVisible();
    await expect(page.getByText('更新失败', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: '进入编辑模式' }).click();
    expect(await editor.innerText()).toContain('this is not valid mermaid syntax !!!');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('edits the latest external source while retaining controls on the prior finished revision', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-external-source-')));
  const sourcePath = join(directory, 'diagram.md');
  const validSource = [
    '# Valid revision',
    '',
    '```mermaid',
    'flowchart LR',
    '  A --> B',
    '```',
  ].join('\n');
  const invalidSource = [
    '# Invalid revision',
    '',
    '```mermaid',
    'this is not valid mermaid syntax !!!',
    '```',
  ].join('\n');
  await writeFile(sourcePath, validSource, 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'source-recovery-drafts.json'),
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = page.frameLocator('iframe[data-finished-document="active"]');
    await expect(
      finishedDocument.locator('[data-render-task-kind="mermaid"] .render-task-output svg'),
    ).toBeVisible({ timeout: 15_000 });

    await writeFile(sourcePath, invalidSource, 'utf8');
    await expect(page.getByText('更新失败', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(finishedDocument.getByRole('heading', { name: 'Valid revision' })).toBeVisible();

    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    expect(await editor.innerText()).toContain('this is not valid mermaid syntax !!!');

    await page.getByRole('button', { name: '进入阅读模式' }).click();
    await finishedDocument.getByRole('button', { name: '查看图表源码' }).click();
    await expect(page.getByLabel('Mermaid 图表源码')).toContainText('flowchart LR');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('guards document switching and preserves both sides of an external conflict', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-conflict-')));
  const firstPath = join(directory, 'first.md');
  const secondPath = join(directory, 'second.md');
  await writeFile(firstPath, '# First', 'utf8');
  await writeFile(secondPath, '# Second', 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify([firstPath, secondPath]),
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'source-recovery-drafts.json'),
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ height: 800, width: 1_200 });
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('# Local');

    await page.getByRole('button', { name: 'second.md', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('保存对“first.md”的修改？');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.getByLabel('first.md', { exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await writeFile(firstPath, '# External', 'utf8');
    await expect(page.getByRole('dialog')).toContainText('“first.md”已在外部修改', {
      timeout: 15_000,
    });
    await expect.poll(() => readFile(firstPath, 'utf8')).toBe('# External');
    await page.getByRole('button', { name: '采用磁盘版本' }).click();
    await expect(editor).toContainText('# External');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('restores an unsaved recovery draft without writing it to the source document', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-recovery-')));
  const sourcePath = join(directory, 'guide.md');
  const sessionPath = join(directory, 'session.json');
  const draftsPath = join(directory, 'source-recovery-drafts.json');
  await writeFile(sourcePath, '# Saved', 'utf8');
  await writeFile(
    sessionPath,
    JSON.stringify({
      activeDocumentPath: sourcePath,
      openDocuments: [
        {
          lastOpenedAt: Date.now(),
          name: 'guide.md',
          path: sourcePath,
          readingPosition: { headingOffset: 0, relativeProgress: 0 },
        },
      ],
      recentDocuments: [],
      version: 1,
    }),
    'utf8',
  );
  await writeFile(
    draftsPath,
    JSON.stringify({
      drafts: [
        {
          baselineSource: '# Saved',
          name: 'guide.md',
          path: sourcePath,
          selection: { anchor: 11, head: 11 },
          source: '# Recovered',
          updatedAt: Date.now(),
          version: 1,
        },
      ],
      version: 1,
    }),
    'utf8',
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: sessionPath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: draftsPath,
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    const editor = page.locator('.cm-content');
    await expect(editor).toContainText('# Recovered');
    await expect(page.getByText('已恢复草稿 · 未保存', { exact: true })).toBeVisible();
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe('# Saved');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('guards closing the main window while source changes are unsaved', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-close-')));
  const sourcePath = join(directory, 'guide.md');
  await writeFile(sourcePath, '# Original', 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_CLOSE_GUARD: '1',
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'source-recovery-drafts.json'),
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('# Unsaved');

    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    await expect(page.getByRole('dialog')).toContainText('保存对“guide.md”的修改？');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('[data-source-editor-region]')).toBeVisible();

    await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    await page.getByRole('button', { name: '不保存', exact: true }).click();
    await expect.poll(() => electronApp.windows().length).toBe(0);
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe('# Original');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('guards application quit and exits only after the reader confirms', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-source-quit-')));
  const sourcePath = join(directory, 'guide.md');
  await writeFile(sourcePath, '# Original', 'utf8');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_CLOSE_GUARD: '1',
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'source-recovery-drafts.json'),
      NODE_ENV: 'test',
    },
  });
  let exited = false;
  const exitPromise = new Promise<void>((resolveExit) => {
    electronApp.process().once('exit', () => {
      exited = true;
      resolveExit();
    });
  });

  try {
    const page = await electronApp.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '进入编辑模式' }).click();
    const editor = page.locator('.cm-content');
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText('# Unsaved');

    await electronApp.evaluate(({ app }) => app.quit());
    await expect(page.getByRole('dialog')).toContainText('退出浮现前');
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('[data-source-editor-region]')).toBeVisible();
    expect(exited).toBe(false);

    await electronApp.evaluate(({ app }) => app.quit());
    await expect(page.getByRole('dialog')).toContainText('退出浮现前');
    await Promise.all([
      exitPromise,
      page.getByRole('button', { name: '不保存', exact: true }).click(),
    ]);
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe('# Original');
  } finally {
    if (!exited) await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
