import { createCanvas, loadImage } from '@napi-rs/canvas';
import { _electron as electron, expect, test, type Page } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createDefaultReaderPreferences } from '../../packages/shared-types/src/index';
import { captureElectronWindow } from './capture-window';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;

const textPoint = (page: Page, line: number, offset: number) =>
  page
    .locator('.cm-line')
    .nth(line)
    .evaluate((element, character) => {
      const range = document.createRange();
      range.setStart(element.firstChild!, character);
      range.setEnd(element.firstChild!, character + 1);
      const box = range.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }, offset);

for (const appearance of ['light', 'dark'] as const) {
  test(`paints single-line and multiline source selections in ${appearance} mode`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-source-selection-'));
    const sourcePath = join(directory, 'selection.md');
    const preferencesPath = join(directory, 'preferences.json');
    await writeFile(
      sourcePath,
      '# Selection\n\nAlpha          beta gamma.\nDelta          epsilon zeta.',
    );
    await writeFile(
      preferencesPath,
      JSON.stringify({
        ...createDefaultReaderPreferences(),
        appearance,
      }),
    );
    const app = await electron.launch({
      executablePath: electronPath,
      args: [resolve('apps/desktop')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
        FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
        FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
        FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'drafts.json'),
      },
    });
    try {
      const page = await app.firstWindow();
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.getByRole('button', { name: '打开 Markdown', exact: true }).click();
      await page.getByRole('button', { name: '进入编辑模式', exact: true }).click();

      const checkSelection = async (name: string, lines: number[]) => {
        const points = await Promise.all(lines.map((line) => textPoint(page, line, 8)));
        await page.waitForFunction(
          (samples) =>
            samples.every((point) =>
              [...document.querySelectorAll('.cm-selectionBackground')].some((element) => {
                const box = element.getBoundingClientRect();
                return (
                  point.x > box.left &&
                  point.x < box.right &&
                  point.y > box.top &&
                  point.y < box.bottom
                );
              }),
            ),
          points,
        );
        const screenshot = test.info().outputPath(`${name}.png`);
        const width = await page.evaluate(() => innerWidth);
        // A multiline selection fills the trailing space; use the line's leading
        // padding as the unselected reference on both active and inactive lines.
        const plainX = await page
          .locator('.cm-line')
          .first()
          .evaluate((element) => element.getBoundingClientRect().left + 3);
        // Sample whitespace, not glyphs: DOM selection rectangles can exist while
        // an opaque active-line background hides every selected pixel.
        await expect
          .poll(
            async () => {
              await captureElectronWindow(app, page, screenshot);
              const image = await loadImage(screenshot);
              const canvas = createCanvas(image.width, image.height);
              const context = canvas.getContext('2d');
              context.drawImage(image, 0, 0);
              const scale = image.width / width;
              const pixel = (x: number, y: number) =>
                context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
              return Math.min(
                ...points.map(({ x, y }) => {
                  const selected = pixel(x, y);
                  const plain = pixel(plainX, y);
                  return [0, 1, 2].reduce(
                    (sum, channel) => sum + Math.abs(selected[channel]! - plain[channel]!),
                    0,
                  );
                }),
              );
            },
            { message: `${name}: selected text must remain visibly distinct from its line` },
          )
          .toBeGreaterThan(12);

        const colors = await page
          .locator('.cm-selectionBackground')
          .first()
          .evaluate((element) => {
            const swatch = document.createElement('span');
            swatch.style.backgroundColor = 'var(--selected)';
            element.append(swatch);
            const expected = getComputedStyle(swatch).backgroundColor;
            swatch.remove();
            return { actual: getComputedStyle(element).backgroundColor, expected };
          });
        expect(colors.actual).toBe(colors.expected);
      };

      for (const endLine of [2, 3]) {
        const start = await textPoint(page, 2, 0);
        const end = await textPoint(page, endLine, 20);
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(end.x, end.y, { steps: 8 });
        await page.mouse.up();
        const lines = endLine === 2 ? [2] : [2, 3];
        const name = endLine === 2 ? 'single-line' : 'multiline';
        await checkSelection(name, lines);
        await page.getByRole('button', { name: '保存 Markdown', exact: true }).focus();
        await checkSelection(`${name}-blurred`, lines);
      }
    } finally {
      await app.close();
      await rm(directory, { force: true, recursive: true });
    }
  });
}
