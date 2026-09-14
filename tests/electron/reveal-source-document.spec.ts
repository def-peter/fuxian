import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;

for (const locale of ['zh-CN', 'en-US']) {
  test(`document context menu reveals files without changing the session (${locale})`, async () => {
    const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-reveal-')));
    const firstPath = join(directory, '正在阅读.md');
    const secondPath = join(directory, '中文 长标题 with spaces # &.markdown');
    const sessionPath = join(directory, 'session.json');
    await writeFile(firstPath, '# Reading\n\n' + 'Paragraph.\n\n'.repeat(100));
    await writeFile(secondPath, '# Another document');
    const app = await electron.launch({
      executablePath: electronPath,
      args: [resolve('apps/desktop')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FUXIAN_E2E_SYSTEM_LOCALE: locale,
        FUXIAN_E2E_SESSION_FILE: sessionPath,
        FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
        FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify([firstPath, secondPath]),
      },
    });
    try {
      // Exercise the real preload + IPC + filesystem checks; intercept only the
      // final OS call, so hidden E2E never opens Finder/Explorer on the desktop.
      await app.evaluate(({ shell }) => {
        Reflect.set(globalThis, 'revealedPaths', []);
        shell.showItemInFolder = (path: string) => {
          if (Reflect.get(globalThis, 'failReveal')) throw new Error('shell failure');
          (Reflect.get(globalThis, 'revealedPaths') as string[]).push(path);
        };
      });
      const window = await app.firstWindow();
      await window.setViewportSize({ width: 1440, height: 900 });
      await window
        .getByRole('button', {
          name: locale === 'zh-CN' ? '打开 Markdown' : 'Open Markdown',
          exact: true,
        })
        .click();
      const sidebar = window.getByRole('complementary', {
        name: locale === 'zh-CN' ? '文档会话' : 'Document session',
      });
      const first = sidebar.getByRole('button', { name: basename(firstPath), exact: true });
      const second = sidebar.getByRole('button', { name: basename(secondPath), exact: true });
      await first.click();
      const frame = window.frameLocator('iframe[data-finished-document="active"]');
      await expect(frame.getByRole('heading', { name: 'Reading', exact: true })).toBeVisible();
      await frame.locator('body').evaluate(() => window.scrollTo(0, 500));
      await expect
        .poll(() => frame.locator('body').evaluate(() => window.scrollY))
        .toBeGreaterThan(400);
      await expect
        .poll(async () => {
          try {
            return JSON.parse(await readFile(sessionPath, 'utf8')).activeDocumentPath;
          } catch {
            return undefined;
          }
        })
        .toBe(firstPath);

      const beforeWidth = await second.boundingBox();
      await second.click({ button: 'right' });
      const menu = window.getByRole('menu');
      const label =
        process.platform === 'darwin'
          ? locale === 'zh-CN'
            ? '在访达中显示'
            : 'Reveal in Finder'
          : process.platform === 'win32'
            ? locale === 'zh-CN'
              ? '在文件资源管理器中显示'
              : 'Show in File Explorer'
            : locale === 'zh-CN'
              ? '在文件管理器中显示'
              : 'Show in File Manager';
      await expect(menu.getByRole('menuitem')).toHaveCount(1);
      await expect(window.getByRole('tooltip')).toHaveCount(0);
      await menu.getByRole('menuitem', { name: label }).click();
      await expect(menu).toBeHidden();
      await expect(first).toHaveAttribute('aria-current', 'page');
      await expect(second).toBeFocused();
      expect((await second.boundingBox())?.width).toBe(beforeWidth?.width);
      expect(await frame.locator('body').evaluate(() => window.scrollY)).toBeGreaterThan(400);
      expect(await app.evaluate(() => Reflect.get(globalThis, 'revealedPaths'))).toEqual([
        secondPath,
      ]);

      await second.press('Shift+F10');
      await expect(menu).toBeVisible();
      await window.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(second).toBeFocused();
      await second.press('Shift+F10');
      await window.keyboard.press('ArrowDown');
      await window.keyboard.press('Enter');
      await expect(menu).toBeHidden();
      expect(await app.evaluate(() => Reflect.get(globalThis, 'revealedPaths'))).toEqual([
        secondPath,
        secondPath,
      ]);

      // Closing is still the sole row action. Reveal from recent must not reopen.
      await sidebar
        .getByRole('button', {
          name:
            locale === 'zh-CN'
              ? `关闭“${basename(secondPath)}”`
              : `Close “${basename(secondPath)}”`,
          exact: true,
        })
        .click();
      await expect
        .poll(async () => JSON.parse(await readFile(sessionPath, 'utf8')).recentDocuments.length)
        .toBe(1);
      const before = JSON.parse(await readFile(sessionPath, 'utf8'));
      await second.click({ button: 'right' });
      await menu.getByRole('menuitem', { name: label }).click();
      await expect(menu).toBeHidden();
      expect(JSON.parse(await readFile(sessionPath, 'utf8'))).toEqual(before);
      expect(await app.evaluate(() => Reflect.get(globalThis, 'revealedPaths'))).toEqual([
        secondPath,
        secondPath,
        secondPath,
      ]);

      const invalid = await window.evaluate(() =>
        window.fuxian.revealSourceDocument('https://example.com/not-a-file.md'),
      );
      expect(invalid.status).toBe('failed');
      await app.evaluate(() => Reflect.set(globalThis, 'failReveal', true));
      await second.click({ button: 'right' });
      await menu.getByRole('menuitem', { name: label }).click();
      const alert = window
        .getByRole('alert')
        .filter({ hasText: locale === 'zh-CN' ? '无法显示文件位置' : 'Cannot reveal file' });
      await expect(alert).toContainText(secondPath);
      await alert
        .getByRole('button', { name: locale === 'zh-CN' ? '关闭' : 'Close', exact: true })
        .click();
      await expect(alert).toBeHidden();

      await rm(secondPath);
      await second.click({ button: 'right' });
      await menu.getByRole('menuitem', { name: label }).click();
      await expect(alert).toContainText(
        locale === 'zh-CN' ? '文件已移动或删除' : 'moved or deleted',
      );
      await expect(first).toHaveAttribute('aria-current', 'page');
      expect(await app.evaluate(() => Reflect.get(globalThis, 'revealedPaths'))).toHaveLength(3);
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
