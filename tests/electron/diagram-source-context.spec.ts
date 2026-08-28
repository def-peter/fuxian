import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('diagram source keeps its identity and can locate the owning diagram', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-diagram-source-context-'));
  const sourcePath = join(directory, 'diagram-source-context.md');
  await writeFile(
    sourcePath,
    [
      '# 图表上下文',
      '',
      '## 同一章节',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[第一张图] --> B[稳定目标]',
      '```',
      '',
      ...Array.from({ length: 30 }, (_, index) => `第 ${index + 1} 段用于形成长文档。`),
      '',
      '```mermaid',
      'flowchart LR',
      '  C[第二张图] --> D[滚动目标]',
      '```',
    ].join('\n\n'),
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
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    const diagrams = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(diagrams).toHaveCount(2);
    const firstDiagram = diagrams.nth(0);
    const secondDiagram = diagrams.nth(1);
    await expect(firstDiagram.locator('.render-task-output svg')).toBeVisible({ timeout: 10_000 });
    await expect(secondDiagram.locator('.render-task-output svg')).toBeVisible({ timeout: 10_000 });

    await firstDiagram.hover();
    await firstDiagram.getByRole('button', { name: '查看图表源码' }).click();
    const sourceDrawer = window.getByRole('complementary', { name: '图表源码' });
    await expect(sourceDrawer).toContainText('同一章节 · 图表 1');
    await expect
      .poll(() =>
        sourceDrawer
          .locator('footer')
          .evaluate((footer) => footer.scrollWidth <= footer.clientWidth),
      )
      .toBe(true);

    await secondDiagram.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await expect(sourceDrawer).toContainText('同一章节 · 图表 1');
    await sourceDrawer.getByRole('button', { name: '定位到图表' }).click();

    await expect(firstDiagram).toBeFocused();
    await expect
      .poll(() => firstDiagram.evaluate((element) => getComputedStyle(element).outlineColor))
      .not.toBe('rgba(0, 0, 0, 0)');
    await expect(sourceDrawer).toBeVisible();
    await expect
      .poll(() =>
        firstDiagram.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
        }),
      )
      .toBe(true);

    await secondDiagram.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await secondDiagram.hover();
    await secondDiagram.getByRole('button', { name: '查看图表源码' }).click();
    await expect(sourceDrawer).toContainText('同一章节 · 图表 2');
    await expect(sourceDrawer.getByLabel('Mermaid 图表源码')).toContainText('第二张图');

    await writeFile(sourcePath, '# 图表已移除\n\n外部修订不再包含原图。');
    await expect(sourceDrawer).toHaveCount(0, { timeout: 10_000 });
    await expect(finishedDocument.getByRole('heading', { name: '图表已移除' })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
