import { _electron as electron, expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultReaderPreferences } from '../../packages/shared-types/src/index';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

interface ToolbarGeometry {
  auxiliaryWidth: number;
  commandGap: number;
  displayWidth: number;
  modeX: number;
}

const readToolbarGeometry = async (page: Page): Promise<ToolbarGeometry> => {
  const [auxiliary, firstCommand, display, mode] = await Promise.all([
    page.locator('[data-document-display-auxiliary]').boundingBox(),
    page.getByRole('button', { name: '导出 PDF' }).boundingBox(),
    page.locator('[data-document-display-controls]').boundingBox(),
    page.getByRole('radiogroup', { name: '文档显示模式' }).boundingBox(),
  ]);
  if (!auxiliary || !firstCommand || !display || !mode) {
    throw new Error('无法读取文档显示组件的布局。');
  }
  return {
    auxiliaryWidth: auxiliary.width,
    commandGap: firstCommand.x - (display.x + display.width),
    displayWidth: display.width,
    modeX: mode.x,
  };
};

const expectStableDisplayGeometry = (
  reference: ToolbarGeometry,
  candidate: ToolbarGeometry,
): void => {
  expect(Math.abs(candidate.modeX - reference.modeX)).toBeLessThanOrEqual(1);
  expect(candidate.auxiliaryWidth).toBeCloseTo(reference.auxiliaryWidth, 1);
  expect(candidate.displayWidth).toBeCloseTo(reference.displayWidth, 1);
};

const selectDocumentWidth = async (page: Page, label: 'A4' | '自定义'): Promise<void> => {
  const trigger = page.getByRole('button', { name: '文档宽度' });
  await trigger.click();
  await page.getByRole('radio', { exact: true, name: label }).click();
  await page
    .frameLocator('iframe[title="Finished document"]')
    .locator('body')
    .click({ position: { x: 20, y: 20 } });
  await expect(page.locator('[data-slot="popover-content"]')).toBeHidden();
};

test('finished-document tables remain compact and readable in continuous and paper modes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-table-density-'));
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: resolve(repositoryRoot, 'fixtures/showcase.md'),
      NODE_ENV: 'test',
    },
  });

  try {
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ height: 900, width: 1_440 });
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    const continuousTable = page.frameLocator('iframe[title="Finished document"]').locator('table');
    await expect(continuousTable).toBeVisible();
    const continuousCells = await continuousTable.locator('th, td').evaluateAll((cells) =>
      cells.map((cell) => {
        const style = getComputedStyle(cell);
        return {
          clientHeight: cell.clientHeight,
          lineHeight: style.lineHeight,
          paddingBottom: style.paddingBottom,
          paddingTop: style.paddingTop,
          scrollHeight: cell.scrollHeight,
        };
      }),
    );
    expect(continuousCells[0]).toMatchObject({
      lineHeight: '21px',
      paddingBottom: '8px',
      paddingTop: '8px',
    });
    expect(continuousCells.every((cell) => cell.scrollHeight <= cell.clientHeight)).toBe(true);

    await page.getByRole('radio', { name: '纸张预览' }).click();
    const paperTable = page
      .frameLocator('iframe[title="纸张预览"]')
      .locator('.pagedjs_page_content table')
      .first();
    await expect(paperTable).toBeVisible({ timeout: 20_000 });
    const paperCell = await paperTable
      .locator('th, td')
      .first()
      .evaluate((cell) => {
        const style = getComputedStyle(cell);
        return {
          lineHeight: style.lineHeight,
          paddingBottom: style.paddingBottom,
          paddingTop: style.paddingTop,
        };
      });
    expect(paperCell).toEqual({
      lineHeight: '21px',
      paddingBottom: '8px',
      paddingTop: '8px',
    });
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('document display controls stay fixed across width, pagination, and viewport states', async () => {
  test.setTimeout(45_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-toolbar-layout-'));
  const sourcePath = join(directory, 'toolbar-layout.md');
  await writeFile(
    sourcePath,
    [
      '# 工具栏稳定性',
      '',
      ...Array.from({ length: 120 }, (_, index) =>
        `第 ${index + 1} 段用于形成多位数纸张页数，并验证分页状态变化不会推动显示模式组件。`.repeat(
          6,
        ),
      ),
    ].join('\n\n'),
  );
  await writeFile(
    join(directory, 'preferences.json'),
    JSON.stringify(createDefaultReaderPreferences()),
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
    const page = await electronApp.firstWindow();
    await page.setViewportSize({ height: 900, width: 1_440 });
    await page.getByRole('button', { name: '打开 Markdown' }).click();

    const [searchButton, editButton, exportButton] = await Promise.all([
      page.getByRole('button', { name: '页内查找' }).boundingBox(),
      page.getByRole('button', { name: '进入编辑模式' }).boundingBox(),
      page.getByRole('button', { name: '导出 PDF' }).boundingBox(),
    ]);
    if (!searchButton || !editButton || !exportButton) {
      throw new Error('无法读取搜索、编辑或导出按钮的位置。');
    }
    expect(searchButton.x).toBeLessThan(editButton.x);
    expect(editButton.x).toBeLessThan(exportButton.x);

    const adaptive = await readToolbarGeometry(page);
    expect(adaptive.auxiliaryWidth).toBeCloseTo(80, 0);
    expect(adaptive.commandGap).toBeGreaterThanOrEqual(10);

    await selectDocumentWidth(page, 'A4');
    expectStableDisplayGeometry(adaptive, await readToolbarGeometry(page));
    await selectDocumentWidth(page, '自定义');
    expectStableDisplayGeometry(adaptive, await readToolbarGeometry(page));

    await page.getByRole('radio', { name: '纸张预览' }).click();
    expectStableDisplayGeometry(adaptive, await readToolbarGeometry(page));
    const pageCountText = page.getByText(/^\d+ 页$/);
    await expect(pageCountText).toBeVisible({ timeout: 20_000 });
    expect(Number.parseInt((await pageCountText.textContent()) ?? '0', 10)).toBeGreaterThanOrEqual(
      10,
    );
    expectStableDisplayGeometry(adaptive, await readToolbarGeometry(page));

    await page.getByRole('radio', { name: '无界阅读' }).click();
    await page.setViewportSize({ height: 768, width: 1_024 });
    await expect(page.locator('[data-session-root]')).toHaveAttribute(
      'data-shell-layout',
      'medium',
    );
    const mediumContinuous = await readToolbarGeometry(page);
    await page.getByRole('radio', { name: '纸张预览' }).click();
    expectStableDisplayGeometry(mediumContinuous, await readToolbarGeometry(page));

    await page.setViewportSize({ height: 620, width: 720 });
    await expect(page.locator('[data-session-root]')).toHaveAttribute(
      'data-shell-layout',
      'narrow',
    );
    await page.keyboard.press('Control+f');
    const toolbarOverflow = await page.locator('[data-reader-toolbar]').evaluate((toolbar) => ({
      clientWidth: toolbar.clientWidth,
      scrollWidth: toolbar.scrollWidth,
    }));
    expect(toolbarOverflow.scrollWidth).toBeLessThanOrEqual(toolbarOverflow.clientWidth);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
