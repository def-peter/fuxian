import { _electron as electron, expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('long document names, adaptive document width, and outline controls remain natural', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-layout-regression-'));
  const longName = `${'这是一份很长的文档标题'.repeat(5)}.md`;
  const sourcePath = join(directory, longName);
  await writeFile(
    sourcePath,
    '# Layout regression\n\nReadable content should use the available page width.',
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(tmpdir(), `fuxian-layout-${randomUUID()}.json`),
      FUXIAN_E2E_SESSION_FILE: join(tmpdir(), `fuxian-layout-${randomUUID()}.json`),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const settingsButton = window.getByRole('button', { name: '设置' });
    const appVersion = await electronApp.evaluate(({ app }) => app.getVersion());
    await expect(settingsButton.locator('[data-app-version]')).toHaveText(`v${appVersion}`);
    const settingsBox = await settingsButton.evaluate((element) =>
      element.getBoundingClientRect().toJSON(),
    );
    expect.soft(settingsBox.bottom).toBe(900);

    const displayModeButtons = window.getByRole('radiogroup', { name: '文档显示模式' });
    await expect(displayModeButtons).toBeVisible();
    expect.soft((await displayModeButtons.boundingBox())?.height).toBeLessThanOrEqual(28);
    const documentWidthTrigger = window.getByRole('button', { name: '文档宽度' });
    await expect(documentWidthTrigger).toHaveText('自适应');
    await documentWidthTrigger.click();
    const documentWidthPopover = window.locator('[data-slot="popover-content"]');
    await expect(documentWidthPopover).toBeVisible();
    await window
      .frameLocator('iframe[data-finished-document="active"]')
      .locator('body')
      .click({ position: { x: 20, y: 20 } });
    await expect(documentWidthPopover).toBeHidden();

    const documentName = window.locator(
      'aside[aria-label="文档会话"] button[aria-current="page"] span',
    );
    const titleOverflow = await documentName.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        textOverflow: style.textOverflow,
      };
    });
    expect.soft(titleOverflow.scrollWidth).toBeGreaterThan(titleOverflow.clientWidth);
    expect.soft(titleOverflow.textOverflow).toBe('ellipsis');

    const iframe = window.locator('iframe[data-finished-document="active"]');
    const iframeWidth = await iframe.evaluate((element) => element.getBoundingClientRect().width);
    const documentWidths = await window
      .frameLocator('iframe[data-finished-document="active"]')
      .locator('body')
      .evaluate((body) => ({
        body: body.getBoundingClientRect().width,
        heading: document.querySelector('h1')?.getBoundingClientRect().toJSON(),
        viewport: document.documentElement.clientWidth,
      }));
    expect.soft(documentWidths.body).toBeGreaterThanOrEqual(iframeWidth - 8);
    expect.soft(documentWidths.heading?.width).toBeGreaterThanOrEqual(iframeWidth - 112);

    const outline = window.getByRole('complementary', { name: '大纲' });
    const outlineBox = await outline.evaluate((element) =>
      element.getBoundingClientRect().toJSON(),
    );
    const toggleBox = await window
      .getByRole('button', { name: '隐藏大纲' })
      .evaluate((element) => element.getBoundingClientRect().toJSON());
    expect.soft(toggleBox.x).toBeGreaterThanOrEqual(outlineBox.x - toggleBox.width - 24);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
