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
const sourcePath = resolve(repositoryRoot, 'fixtures/showcase.md');

test('tooltips stay clear of file actions and use one global treatment', async () => {
  test.setTimeout(15_000);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-tooltip-behavior-'));
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(temporaryDirectory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(temporaryDirectory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const session = window.getByRole('complementary', { name: '文档会话' });
    const documentButton = session.getByRole('button', { exact: true, name: 'showcase.md' });
    const closeButton = session.getByRole('button', { name: '关闭 showcase.md' });
    await documentButton.hover();
    const fileTooltip = window.getByRole('tooltip', { exact: true, name: sourcePath });
    await expect(fileTooltip).toContainText(sourcePath);
    await expect
      .poll(() =>
        fileTooltip.evaluate((tooltip) =>
          tooltip.parentElement ? getComputedStyle(tooltip.parentElement).pointerEvents : null,
        ),
      )
      .toBe('none');
    const sharedTooltipClass = await fileTooltip.getAttribute('class');
    const [fileTooltipBox, closeButtonBox] = await Promise.all([
      fileTooltip.boundingBox(),
      closeButton.boundingBox(),
    ]);
    if (!fileTooltipBox || !closeButtonBox) throw new Error('无法读取文件提示或关闭按钮的位置。');
    const overlapsCloseButton =
      fileTooltipBox.left < closeButtonBox.x + closeButtonBox.width &&
      fileTooltipBox.x + fileTooltipBox.width > closeButtonBox.x &&
      fileTooltipBox.y < closeButtonBox.y + closeButtonBox.height &&
      fileTooltipBox.y + fileTooltipBox.height > closeButtonBox.y;
    expect(overlapsCloseButton).toBe(false);
    await closeButton.hover({ timeout: 2_000 });
    await expect(fileTooltip).toBeHidden();

    const assertGlobalTooltip = async (buttonName: string, tooltipText: string): Promise<void> => {
      const button = window.getByRole('button', { name: buttonName });
      await expect(button).not.toHaveAttribute('title');
      await button.hover();
      const tooltip = window.getByRole('tooltip', { exact: true, name: tooltipText });
      await expect(tooltip).toHaveText(tooltipText);
      await expect(tooltip).toHaveAttribute('class', sharedTooltipClass ?? '');
    };

    await assertGlobalTooltip('文档宽度', '文档宽度');
    await assertGlobalTooltip('导出 PDF', '导出 PDF');
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
