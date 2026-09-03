import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(import.meta.dirname, '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('opens an interactive article structure map derived from the content outline', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-article-structure-'));
  const sourcePath = join(directory, '文章结构测试.md');
  await writeFile(
    sourcePath,
    ['# 产品方案', '## 背景', '### 当前问题', '## 目标', '# 发布计划', '## 验证'].join('\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const outline = window.getByRole('complementary', { name: '大纲' });
    await expect(outline).toBeVisible();
    await outline.getByRole('button', { name: '查看大纲图' }).click();

    const dialog = window.getByRole('dialog', { name: '文章大纲图' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('文章结构测试.md · 6 个标题')).toBeVisible();
    const svg = dialog.getByRole('img', { name: '当前文章的大纲思维导图' });
    await expect(svg).toBeVisible();
    await expect(svg.locator('foreignObject').filter({ hasText: '文章结构测试' })).toBeVisible();
    await expect(svg.locator('foreignObject').filter({ hasText: '产品方案' })).toBeVisible();
    await expect(svg.locator('foreignObject').filter({ hasText: '发布计划' })).toBeVisible();

    await expect(dialog.getByRole('button', { name: '缩小文章大纲图' })).toBeEnabled();
    await dialog.getByRole('button', { name: '放大文章大纲图' }).click();
    await dialog.getByRole('button', { name: '适应文章大纲图窗口' }).click();
    const foldControl = dialog.getByRole('button', { name: '折叠或展开此标题' }).first();
    await expect(foldControl).toHaveAttribute('aria-expanded', 'true');
    await foldControl.press('Enter');
    await expect(foldControl).toHaveAttribute('aria-expanded', 'false');

    await dialog.getByRole('button', { name: '关闭大纲图' }).click();
    await expect(dialog).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
