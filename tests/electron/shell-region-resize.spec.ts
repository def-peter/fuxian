import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

interface LaunchOptions {
  preferencesFilePath: string;
  sessionFilePath: string;
  sourcePath: string;
}

const launchDesktop = ({
  preferencesFilePath,
  sessionFilePath,
  sourcePath,
}: LaunchOptions): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesFilePath,
      FUXIAN_E2E_SESSION_FILE: sessionFilePath,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

const resizeFromSeparator = async (page: Page, name: string, deltaX: number): Promise<void> => {
  const separator = page.getByRole('separator', { name });
  const box = await separator.boundingBox();
  if (!box) throw new Error(`找不到“${name}”分隔线。`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + deltaX, y, { steps: 8 });
  await page.mouse.up();
};

const regionWidth = async (page: Page, name: string): Promise<number> => {
  const box = await page.getByRole('complementary', { name }).boundingBox();
  if (!box) throw new Error(`找不到“${name}”区域。`);
  return Math.round(box.width);
};

test('resizes, persists, and restores independent inline shell-region widths', async () => {
  test.setTimeout(60_000);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-shell-region-resize-'));
  const launchOptions: LaunchOptions = {
    preferencesFilePath: join(temporaryDirectory, 'reader-preferences.json'),
    sessionFilePath: join(temporaryDirectory, 'document-session.json'),
    sourcePath: join(temporaryDirectory, 'shell-region-resize.md'),
  };
  await writeFile(
    launchOptions.sourcePath,
    ['# 可调整区域', '', '## 第一节', '', '用于验证两侧区域可独立调整宽度。'].join('\n'),
    'utf8',
  );
  let electronApp = await launchDesktop(launchOptions);

  try {
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    await expect(window.getByRole('separator', { name: '调整文档会话宽度' })).toBeVisible();
    await expect(window.getByRole('separator', { name: '调整内容目录宽度' })).toBeVisible();
    expect(await regionWidth(window, '文档会话')).toBe(216);
    expect(await regionWidth(window, '内容目录')).toBe(216);

    const verticalGeometry = await window.evaluate(() => {
      const root = document.querySelector<HTMLElement>('[data-session-root]')!;
      const toolbar = document.querySelector<HTMLElement>('[data-reader-toolbar]')!;
      const readingRegion = document.querySelector<HTMLElement>('[data-finished-document-region]')!;
      const outline = document.querySelector<HTMLElement>('aside[aria-label="内容目录"]')!;
      return {
        outlineBottom: outline.getBoundingClientRect().bottom,
        outlineHeight: outline.getBoundingClientRect().height,
        readingBottom: readingRegion.getBoundingClientRect().bottom,
        readingHeight: readingRegion.getBoundingClientRect().height,
        rootBottom: root.getBoundingClientRect().bottom,
        rootHeight: root.getBoundingClientRect().height,
        toolbarHeight: toolbar.getBoundingClientRect().height,
      };
    });
    const expectedReadingHeight = verticalGeometry.rootHeight - verticalGeometry.toolbarHeight;
    expect(verticalGeometry.readingHeight).toBe(expectedReadingHeight);
    expect(verticalGeometry.outlineHeight).toBe(expectedReadingHeight);
    expect(verticalGeometry.readingBottom).toBe(verticalGeometry.rootBottom);
    expect(verticalGeometry.outlineBottom).toBe(verticalGeometry.rootBottom);

    await resizeFromSeparator(window, '调整文档会话宽度', 72);
    await resizeFromSeparator(window, '调整内容目录宽度', -56);
    const documentSessionWidth = await regionWidth(window, '文档会话');
    const contentOutlineWidth = await regionWidth(window, '内容目录');
    expect(documentSessionWidth).toBeGreaterThan(216);
    expect(contentOutlineWidth).toBeGreaterThan(216);

    await expect
      .poll(async () => {
        const preferences = JSON.parse(
          await readFile(launchOptions.preferencesFilePath, 'utf8'),
        ) as {
          shell: { contentOutlineWidth: number; documentSessionWidth: number };
        };
        return preferences.shell;
      })
      .toMatchObject({ contentOutlineWidth, documentSessionWidth });

    await electronApp.close();
    electronApp = await launchDesktop(launchOptions);
    window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await expect(window.getByRole('complementary', { name: '文档会话' })).toBeVisible();
    await expect(window.getByRole('complementary', { name: '内容目录' })).toBeVisible();
    await expect.poll(() => regionWidth(window, '文档会话')).toBe(documentSessionWidth);
    await expect.poll(() => regionWidth(window, '内容目录')).toBe(contentOutlineWidth);

    await window.getByRole('separator', { name: '调整文档会话宽度' }).dblclick();
    await window.getByRole('separator', { name: '调整内容目录宽度' }).dblclick();
    expect(await regionWidth(window, '文档会话')).toBe(216);
    expect(await regionWidth(window, '内容目录')).toBe(216);

    await window.setViewportSize({ height: 768, width: 1_024 });
    await expect(window.getByRole('separator', { name: '调整内容目录宽度' })).toHaveCount(0);
    await window.getByRole('button', { name: '打开内容目录' }).click();
    await expect(window.getByRole('dialog')).toHaveCSS('width', '288px');

    await window.setViewportSize({ height: 620, width: 720 });
    await expect(window.getByRole('separator', { name: '调整文档会话宽度' })).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
