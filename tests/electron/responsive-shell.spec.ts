import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultReaderPreferences } from '../../packages/shared-types/src/index';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

interface WindowSize {
  height: number;
  width: number;
}

const launchDesktop = (
  sourcePath: string,
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
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify([sourcePath]),
      NODE_ENV: 'test',
    },
  });

const resizeWindow = (window: Page, size: WindowSize): Promise<void> =>
  window.setViewportSize(size);

test('adapts the reader shell without losing independent region preferences', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-responsive-shell-'));
  const documentDirectory = join(temporaryDirectory, 'documents');
  const sourcePath = join(
    documentDirectory,
    '这是一个用于验证极窄窗口工具栏不会发生遮挡的超长文档名称.md',
  );
  const preferencesFilePath = join(temporaryDirectory, 'reader-preferences.json');
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  await mkdir(documentDirectory, { recursive: true });
  await writeFile(
    sourcePath,
    [
      '# 响应式阅读器',
      '',
      '## 第二节',
      '',
      '用于验证阅读区域。',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[Markdown] --> B[Finished document]',
      '```',
      '',
    ].join('\n'),
    'utf8',
  );
  await writeFile(preferencesFilePath, JSON.stringify(createDefaultReaderPreferences()), 'utf8');

  const electronApp = await launchDesktop(sourcePath, preferencesFilePath, sessionFilePath);

  try {
    const window = await electronApp.firstWindow();
    await resizeWindow(window, { height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const shell = window.locator('[data-session-root]');
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(shell).toHaveAttribute('data-shell-layout', 'wide');
    await expect(window.getByRole('complementary', { name: '文档会话' })).toBeVisible();
    await expect(window.getByRole('complementary', { name: '内容目录' })).toBeVisible();
    await expect(finishedDocument.getByRole('heading', { name: '响应式阅读器' })).toBeVisible();

    await resizeWindow(window, { height: 768, width: 1_024 });
    await expect(shell).toHaveAttribute('data-shell-layout', 'medium');
    await expect(window.getByRole('complementary', { name: '文档会话' })).toBeVisible();
    await expect(window.getByRole('complementary', { name: '内容目录' })).toHaveCount(0);
    await expect(window.getByRole('button', { name: '打开内容目录' })).toBeVisible();
    await expect
      .poll(async () => {
        const preferences = JSON.parse(await readFile(preferencesFilePath, 'utf8')) as {
          shell: { contentOutlineExpanded: boolean };
        };
        return preferences.shell.contentOutlineExpanded;
      })
      .toBe(true);

    await window.getByRole('button', { name: '打开内容目录' }).click();
    const outlineDrawer = window.getByRole('dialog').getByRole('complementary', {
      name: '内容目录',
    });
    await expect(outlineDrawer).toBeVisible();
    await expect(window.getByRole('dialog')).toHaveCSS('width', '288px');
    await outlineDrawer.getByRole('button', { name: '第二节' }).click();
    await expect(window.getByRole('dialog')).toHaveCount(0);

    const mermaidTask = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(mermaidTask).toHaveAttribute('data-render-state', 'succeeded');
    await mermaidTask.hover();
    await mermaidTask.getByRole('button', { name: '查看图表源码' }).click();
    const sourceDrawer = window.getByRole('dialog').getByRole('complementary', {
      name: '图表源码',
    });
    await expect(sourceDrawer).toBeVisible();
    await expect(window.getByRole('dialog')).toHaveCSS('width', '480px');
    await sourceDrawer.getByRole('button', { name: '关闭图表源码' }).click();
    await expect(window.getByRole('dialog')).toHaveCount(0);

    await resizeWindow(window, { height: 620, width: 720 });
    await expect(shell).toHaveAttribute('data-shell-layout', 'narrow');
    await expect(window.getByRole('complementary', { name: '文档会话' })).toHaveCount(0);
    await expect(window.getByRole('button', { name: '打开文档会话' })).toBeVisible();
    await window.getByRole('button', { name: '打开文档会话' }).click();
    await expect(
      window.getByRole('dialog').getByRole('complementary', { name: '文档会话' }),
    ).toBeVisible();
    await expect(window.getByRole('dialog')).toHaveCSS('width', '320px');
    await window.getByRole('button', { name: '收起文档会话' }).click();
    await expect(window.getByRole('dialog')).toHaveCount(0);

    await window.keyboard.press('Control+f');
    await expect(window.getByRole('textbox', { name: '页内查找' })).toBeVisible();
    const toolbarWidths = await window.locator('[data-reader-toolbar]').evaluate((toolbar) => {
      const root = document.querySelector<HTMLElement>('[data-session-root]');
      const rootRectangle = root?.getBoundingClientRect();
      const toolbarRectangle = toolbar.getBoundingClientRect();
      return {
        clientWidth: toolbar.clientWidth,
        insideRoot: rootRectangle
          ? toolbarRectangle.left >= rootRectangle.left &&
            toolbarRectangle.right <= rootRectangle.right
          : false,
        scrollWidth: toolbar.scrollWidth,
      };
    });
    expect(toolbarWidths.scrollWidth).toBeLessThanOrEqual(toolbarWidths.clientWidth);
    expect(toolbarWidths.insideRoot).toBe(true);
    await expect(window.locator('[data-finished-document-region]')).toBeVisible();

    await resizeWindow(window, { height: 900, width: 1_440 });
    await expect(shell).toHaveAttribute('data-shell-layout', 'wide');
    await expect(window.getByRole('complementary', { name: '内容目录' })).toBeVisible();

    await window.getByRole('button', { name: '折叠内容目录' }).click();
    await expect(window.getByRole('complementary', { name: '内容目录' })).toHaveCount(0);
    await window.getByRole('button', { name: '收起文档会话' }).click();
    await expect(window.getByRole('complementary', { name: '文档会话' })).toHaveCount(0);
    await expect
      .poll(async () => {
        const preferences = JSON.parse(await readFile(preferencesFilePath, 'utf8')) as {
          shell: {
            contentOutlineExpanded: boolean;
            documentSessionExpanded: boolean;
          };
        };
        return preferences.shell;
      })
      .toEqual({ contentOutlineExpanded: false, documentSessionExpanded: false });
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
