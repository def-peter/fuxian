import { _electron as electron, expect } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const electronPath = createRequire(resolve(desktopAppPath, 'package.json'))('electron');
const publicDirectory = resolve(repositoryRoot, 'apps/website/public');
const directory = await mkdtemp(join(tmpdir(), 'fuxian-feature-capture-'));

async function capture(app, page, name) {
  await page.mouse.move(0, 0);
  await page.waitForTimeout(500);
  const window = await app.browserWindow(page);
  try {
    const png = await window.evaluate(async (win) => {
      if (win.isVisible()) throw new Error('Capture window must remain hidden.');
      const image = await win.webContents.capturePage(undefined, {
        stayHidden: true,
        stayAwake: true,
      });
      if (image.isEmpty()) throw new Error('Empty screenshot.');
      return image.toPNG().toString('base64');
    });
    await writeFile(join(publicDirectory, 'images', `${name}.png`), Buffer.from(png, 'base64'));
  } finally {
    await window.dispose();
  }
}

try {
  for (const language of ['zh', 'en']) {
    const zh = language === 'zh';
    const sourcePath = join(directory, `reading-guide-${language}.md`);
    await writeFile(
      sourcePath,
      await readFile(join(publicDirectory, 'examples', `reading-guide-${language}.md`)),
    );
    const app = await electron.launch({
      executablePath: electronPath,
      args: [desktopAppPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FUXIAN_E2E_WINDOW_MODE: 'hidden',
        FUXIAN_E2E_SYSTEM_LOCALE: zh ? 'zh-CN' : 'en-US',
        FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
        FUXIAN_E2E_PREFERENCES_FILE: join(directory, `${language}-preferences.json`),
        FUXIAN_E2E_SESSION_FILE: join(directory, `${language}-session.json`),
        FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, `${language}-drafts.json`),
      },
    });
    try {
      const page = await app.firstWindow();
      await page.setViewportSize({ width: 1440, height: 960 });
      await page
        .getByRole('button', { name: zh ? '打开 Markdown' : 'Open Markdown', exact: true })
        .click();
      const document = page.frameLocator('iframe[data-finished-document="active"]');
      await document
        .locator('[data-render-task-kind="mermaid"][data-render-state="succeeded"]')
        .waitFor({ timeout: 30000 });
      await capture(app, page, `feature-reading-${language}`);
      await page
        .getByRole('button', { name: zh ? '查看大纲图' : 'View outline map', exact: true })
        .click();
      const dialog = page.getByRole('dialog', {
        name: zh ? '文章大纲图' : 'Article outline map',
        exact: true,
      });
      await expect(dialog.locator('svg foreignObject')).toHaveCount(16, { timeout: 15000 });
      await page
        .getByRole('button', {
          name: zh ? '适应文章大纲图窗口' : 'Fit outline map to window',
          exact: true,
        })
        .click();
      await capture(app, page, `feature-outline-${language}`);
      await page
        .getByRole('button', { name: zh ? '关闭大纲图' : 'Close outline map', exact: true })
        .click();
      await page
        .getByRole('button', { name: zh ? '进入编辑模式' : 'Enter editing mode', exact: true })
        .click();
      await page.locator('.cm-content').waitFor();
      await capture(app, page, `feature-editing-${language}`);
      await page
        .getByRole('button', { name: zh ? '进入阅读模式' : 'Enter reading mode', exact: true })
        .click();
      await page
        .getByRole('radio', { name: zh ? '纸张预览' : 'Paper preview', exact: true })
        .click();
      const paper = page.frameLocator(`iframe[title="${zh ? '纸张预览' : 'Paper preview'}"]`);
      await expect(page.getByText(zh ? /^\d+ 页$/ : /^\d+ pages$/)).toBeVisible({ timeout: 30000 });
      const pages = paper.locator('.pagedjs_page');
      if ((await pages.count()) < 2) throw new Error('The guide must demonstrate multiple pages.');
      await pages
        .first()
        .evaluate((el) =>
          globalThis.scrollTo(0, el.getBoundingClientRect().bottom + globalThis.scrollY - 520),
        );
      await capture(app, page, `feature-paper-${language}`);
      // Reuse the downloadable example exactly, including the visible source fence.
      await writeFile(
        sourcePath,
        await readFile(join(publicDirectory, 'examples', `reading-flow-${language}.md`)),
      );
      await page
        .getByRole('radio', { name: zh ? '无界阅读' : 'Continuous reading', exact: true })
        .click();
      const svg = document
        .locator('[data-render-task-kind="mermaid"][data-render-state="succeeded"] svg[id]')
        .first();
      await expect(svg).toContainText(zh ? '打开 Markdown' : 'Open Markdown', { timeout: 30000 });
      await svg.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await svg.screenshot({
        path: join(publicDirectory, 'images', `example-flow-${language}.png`),
        animations: 'disabled',
      });
      console.log(
        `Captured ${language}: reading, outline, editing, pagination, and exact Mermaid example.`,
      );
    } finally {
      await app.close();
    }
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
