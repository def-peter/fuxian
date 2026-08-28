import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourcePath = resolve(repositoryRoot, 'fixtures/infographic.md');

test('renders official Infographic text structure and rejects external resources', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-infographic-'));
  const outputPath = join(directory, 'infographic.pdf');
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
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
    const tasks = finishedDocument.locator('[data-render-task-kind="infographic"]');
    await expect(tasks).toHaveCount(3);

    const infographic = tasks.first();
    await expect(infographic).toHaveAttribute('data-render-state', 'succeeded', {
      timeout: 30_000,
    });
    await expect(infographic.locator('.render-task-output > svg')).toBeVisible();
    await expect(
      infographic.locator('foreignObject > span').filter({ hasText: '浮现发布流程' }),
    ).toBeVisible();
    await expect(
      infographic.locator('foreignObject > span').filter({ hasText: '安全渲染' }),
    ).toBeVisible();
    await expect(infographic.locator('foreignObject')).not.toHaveCount(0);
    await expect(infographic.locator('script, iframe, image')).toHaveCount(0);
    await expect(infographic.locator('defs symbol')).not.toHaveCount(0);
    await expect(infographic.locator('use')).not.toHaveCount(0);
    const visibleSnapshot = await infographic
      .locator('.render-task-output > svg')
      .evaluate((svg) => svg.outerHTML);

    const themed = tasks.nth(1);
    await expect(themed).toHaveAttribute('data-render-state', 'succeeded', { timeout: 30_000 });
    await expect(
      themed.locator('foreignObject > span').filter({ hasText: '深色主题' }),
    ).toBeVisible();

    const rejected = tasks.nth(2);
    await expect(rejected).toHaveAttribute('data-render-state', 'failed');
    await expect(rejected.getByText('无法呈现信息图')).toBeVisible();
    await expect(rejected.locator('.render-task-error-detail')).toContainText('不允许外部 URL');
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );

    await infographic.getByRole('button', { name: '查看图表源码' }).click();
    const sourceDrawer = window.getByRole('complementary', { name: '图表源码' });
    await expect(sourceDrawer.getByLabel('AntV Infographic 图表源码')).toContainText(
      '浮现发布流程',
    );
    await sourceDrawer.getByRole('button', { name: '关闭图表源码' }).click();

    await infographic.getByRole('button', { name: '全屏查看图表' }).click();
    const focusDialog = window.getByRole('dialog', { name: '全屏图表' });
    await expect(
      focusDialog.locator('foreignObject > span').filter({ hasText: '稳定导出' }),
    ).toBeVisible();
    await focusDialog.getByRole('button', { name: '返回文档' }).click();

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect.poll(async () => (await electronApp.windows()).length).toBe(2);
    const exportWindow = (await electronApp.windows()).find((candidate) =>
      candidate.url().includes('view=pdf-export'),
    );
    if (!exportWindow) throw new Error('PDF export window was not created.');
    const exportedInfographic = exportWindow.locator(
      '[data-render-task-kind="infographic"] .render-task-output > svg',
    );
    await expect(exportedInfographic.first()).toBeVisible({ timeout: 15_000 });
    expect(await exportedInfographic.first().evaluate((svg) => svg.outerHTML)).toBe(
      visibleSnapshot,
    );
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 15_000 });

    const bytes = await readFile(outputPath);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    const loading = getDocument({ data: new Uint8Array(bytes) });
    const pdf = await loading.promise;
    const text: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(''));
    }
    await loading.destroy();
    expect(text.join('').replace(/\s+/gu, '')).toContain('浮现发布流程');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
