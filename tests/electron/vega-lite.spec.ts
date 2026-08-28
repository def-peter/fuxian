import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourcePath = resolve(repositoryRoot, 'fixtures/vega-lite.md');

test('renders safe Vega-Lite blocks and keeps rejected sources explicit', async () => {
  test.setTimeout(45_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-vega-lite-'));
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
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(finishedDocument.getByText('正文应当立即可读')).toBeVisible();
    const tasks = finishedDocument.locator('[data-render-task-kind="vega-lite"]');
    await expect(tasks).toHaveCount(3);

    const chart = tasks.first();
    await expect(chart).toHaveAttribute('data-render-state', 'succeeded', { timeout: 15_000 });
    await expect(chart.locator('.render-task-output svg')).toBeVisible();
    await expect(chart.locator('text').filter({ hasText: '第一季度' })).toBeVisible();
    await expect(chart.locator('text').filter({ hasText: '第四季度' })).toBeVisible();

    const nondeterministic = tasks.nth(1);
    await expect(nondeterministic).toHaveAttribute('data-render-state', 'failed');
    await expect(nondeterministic.locator('.render-task-error-detail')).toContainText(
      '不支持 random() 表达式',
    );
    const rejected = tasks.nth(2);
    await expect(rejected).toHaveAttribute('data-render-state', 'failed');
    await expect(rejected.getByText('无法呈现图表')).toBeVisible();
    await expect(rejected.locator('.render-task-error-detail')).toContainText('data.values');
    await expect(rejected.locator('.render-task-error-source')).toContainText('example.test');
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );

    await chart.getByRole('button', { name: '查看图表源码' }).click();
    const sourceDrawer = window.getByRole('complementary', { name: '图表源码' });
    await expect(sourceDrawer.getByLabel('Vega-Lite 图表源码')).toContainText('季度收入');
    await sourceDrawer.getByRole('button', { name: '关闭图表源码' }).click();

    await chart.getByRole('button', { name: '全屏查看图表' }).click();
    const focusDialog = window.getByRole('dialog', { name: '全屏图表' });
    await expect(focusDialog.locator('svg.marks')).toBeVisible();
    await expect(focusDialog.locator('text').filter({ hasText: '第四季度' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
