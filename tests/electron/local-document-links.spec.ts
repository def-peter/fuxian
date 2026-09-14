import { _electron as electron, expect, test } from '@playwright/test';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import { captureElectronWindow } from './capture-window';

const electronPath = createRequire(import.meta.url)('electron') as string;
const rendererDirectory = resolve('apps/desktop/out/renderer');
const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
  const path = resolve(rendererDirectory, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (relative(rendererDirectory, path).startsWith('..')) {
    response.writeHead(403).end();
    return;
  }
  void readFile(path).then(
    (bytes) => {
      const types: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
      };
      response
        .writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' })
        .end(bytes);
    },
    () => response.writeHead(404).end(),
  );
});
let rendererUrl: string;
test.beforeAll(async () => {
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing renderer server address');
  rendererUrl = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  await new Promise<void>((done, reject) =>
    server.close((error) => (error ? reject(error) : done())),
  );
});

for (const mode of ['continuous', 'paper']) {
  for (const locale of ['zh-CN', 'en-US']) {
    test(`source-relative links and nonmodal failures (${mode}, ${locale})`, async () => {
      // Hidden Windows UI actions take longer across this multi-step journey.
      if (process.platform === 'win32') test.setTimeout(120_000);
      const directory = await realpath(await mkdtemp(join(tmpdir(), 'fuxian-local-links-')));
      const docs = join(directory, '文档');
      await mkdir(join(docs, 'nested'), { recursive: true });
      const sourcePath = join(docs, 'README.md');
      const targetPath = join(docs, 'query建表.hql');
      const nestedPath = join(docs, 'nested', '含 空格%20.sql');
      const otherPath = join(directory, '另一份.markdown');
      const sessionPath = join(directory, 'session.json');
      await writeFile(
        sourcePath,
        [
          '# Links',
          '[建表脚本](query建表.hql)',
          '[嵌套脚本](nested/含%20空格%2520.sql?download=1#L2)',
          '[上级脚本](../parent.sql)',
          '[另一份](../另一份.markdown?view=1)',
          '[网页](https://example.com/report?q=1#section)',
          '<https://example.com/complete>',
          `[长网址](https://example.com/${'very-long-path-'.repeat(30)})`,
          '[结尾](#结尾)',
          'Paragraph.\n\n'.repeat(40),
          '## 结尾',
          '[不存在](missing.sql)',
          '[目录也不存在](missing/file.sql)',
          '[危险类型](run.exe)',
          '<a href="javascript:alert(1)">危险协议</a>',
          '[再次打开](query建表.hql)',
          '[原生关联](native.txt)',
        ].join('\n\n'),
      );
      await writeFile(targetPath, 'select 1;');
      await writeFile(join(docs, 'native.txt'), 'Native file association');
      await writeFile(nestedPath, 'select 2;');
      await writeFile(join(directory, 'parent.sql'), 'select 3;');
      await writeFile(otherPath, '# Other document\n\n[返回](文档/README.md)');
      const app = await electron.launch({
        executablePath: electronPath,
        args: [resolve('apps/desktop')],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          FUXIAN_E2E_SYSTEM_LOCALE: locale,
          FUXIAN_E2E_SESSION_FILE: sessionPath,
          FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
          FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
          FUXIAN_E2E_LINK_DEFAULT_APP: '1',
          // Cover the localhost base used in development as well as file://.
          ELECTRON_RENDERER_URL: locale === 'en-US' ? rendererUrl : '',
        },
      });
      try {
        // Exercise click → preload → IPC → filesystem. Intercept only OS calls
        // so hidden QA never launches another app, Finder/Explorer or a browser.
        await app.evaluate(({ shell }) => {
          Reflect.set(globalThis, 'openedPaths', []);
          Reflect.set(globalThis, 'openedUrls', []);
          shell.openPath = async (path) => {
            (Reflect.get(globalThis, 'openedPaths') as string[]).push(path);
            return Reflect.get(globalThis, 'failOpen') ? 'Failed to open path' : '';
          };
          shell.openExternal = async (url) => {
            (Reflect.get(globalThis, 'openedUrls') as string[]).push(url);
          };
        });
        const window = await app.firstWindow();
        await window.setViewportSize({ width: 1440, height: 900 });
        const zh = locale === 'zh-CN';
        await window
          .getByRole('button', { name: zh ? '打开 Markdown' : 'Open Markdown', exact: true })
          .click();
        if (mode === 'paper')
          await window.getByRole('radio', { name: zh ? '纸张预览' : 'Paper preview' }).click();
        const reader = window.frameLocator(
          mode === 'paper'
            ? `iframe[title="${zh ? '纸张预览' : 'Paper preview'}"]`
            : 'iframe[data-finished-document="active"]',
        );
        const linkTooltip = reader.getByRole('tooltip');
        const scriptLink = reader.getByRole('link', { name: '建表脚本', exact: true });
        const nestedLink = reader.getByRole('link', { name: '嵌套脚本', exact: true });
        await scriptLink.hover();
        await expect(linkTooltip).toHaveText(targetPath);
        await captureElectronWindow(app, window, test.info().outputPath('local-link-tooltip.png'));
        const surface = await linkTooltip.evaluate((element) => {
          const css = getComputedStyle(element);
          return [
            css.backgroundColor,
            css.color,
            css.borderRadius,
            css.padding,
            css.fontSize,
            css.lineHeight,
          ];
        });
        await window
          .getByRole('complementary', { name: zh ? '文档会话' : 'Document session' })
          .getByRole('button', { name: 'README.md', exact: true })
          .hover();
        await expect(linkTooltip).toHaveCount(0);
        const shellTooltip = window.locator('[data-slot="tooltip-content"]');
        await expect(shellTooltip).toBeVisible();
        expect(
          await shellTooltip.evaluate((element) => {
            const css = getComputedStyle(element);
            return [
              css.backgroundColor,
              css.color,
              css.borderRadius,
              css.padding,
              css.fontSize,
              css.lineHeight,
            ];
          }),
        ).toEqual(surface);
        // Fast handoffs cancel the earlier delayed request and never stack hints.
        await scriptLink.hover();
        await nestedLink.hover();
        await expect(linkTooltip).toHaveText(nestedPath);
        await expect(linkTooltip).toHaveCount(1);
        await window.keyboard.press('Escape');
        await expect(linkTooltip).toHaveCount(0);
        await reader.getByRole('link', { name: '结尾', exact: true }).focus();
        await expect(linkTooltip).toHaveText(zh ? '跳转到：结尾' : 'Go to: 结尾');
        await reader.getByRole('link', { name: '网页', exact: true }).hover();
        await expect(linkTooltip).toHaveText('https://example.com/report?q=1#section');
        await reader
          .getByRole('link', { name: 'https://example.com/complete', exact: true })
          .hover();
        await expect(linkTooltip).toHaveCount(0);
        await reader.getByRole('link', { name: '长网址', exact: true }).hover();
        await expect(linkTooltip).toContainText('very-long-path-');
        expect(
          await linkTooltip.evaluate((element) => element.scrollWidth <= element.clientWidth),
        ).toBe(true);
        await window.mouse.wheel(0, 30);
        await expect(linkTooltip).toHaveCount(0);
        for (const name of ['建表脚本', '嵌套脚本', '上级脚本'])
          await reader.getByRole('link', { name, exact: true }).click();
        await expect
          .poll(() => app.evaluate(() => Reflect.get(globalThis, 'openedPaths')))
          .toEqual([targetPath, nestedPath, join(directory, 'parent.sql')]);
        expect(await app.evaluate(() => Reflect.get(globalThis, 'openedUrls'))).toEqual([]);
        await reader.getByRole('link', { name: '网页', exact: true }).click({ button: 'middle' });
        await expect
          .poll(() => app.evaluate(() => Reflect.get(globalThis, 'openedUrls')))
          .toEqual(['https://example.com/report?q=1#section']);

        await reader.getByRole('link', { name: '另一份', exact: true }).click();
        await expect(
          reader.getByRole('heading', { name: 'Other document', exact: true }),
        ).toBeVisible();
        await reader.getByRole('link', { name: '返回', exact: true }).click();
        await expect(reader.getByRole('heading', { name: 'Links', exact: true })).toBeVisible();
        const sidebar = window.getByRole('complementary', {
          name: zh ? '文档会话' : 'Document session',
        });
        await expect(sidebar.getByRole('button', { name: 'README.md', exact: true })).toHaveCount(
          1,
        );
        await expect(
          sidebar.getByRole('button', { name: '另一份.markdown', exact: true }),
        ).toHaveCount(1);

        await reader.getByRole('link', { name: '结尾', exact: true }).click();
        await expect(reader.getByRole('heading', { name: '结尾', exact: true })).toBeInViewport();
        const missing = reader.getByRole('link', { name: '不存在', exact: true });
        await missing.scrollIntoViewIfNeeded();
        const beforeScroll = await reader.locator('body').evaluate(() => window.scrollY);
        await missing.click();
        const alert = window
          .getByRole('alert')
          .filter({ hasText: zh ? '无法打开文件' : 'Cannot open file' });
        const parent = alert.getByRole('button', {
          name: zh ? '打开所在目录' : 'Open containing folder',
          exact: true,
        });
        const close = alert.getByRole('button', { name: zh ? '关闭' : 'Close', exact: true });
        await expect(alert).toContainText('missing.sql');
        await captureElectronWindow(app, window, test.info().outputPath('local-link-error.png'));
        await expect(alert).toContainText(zh ? '移动、重命名或删除' : 'moved, renamed, or deleted');
        expect(await reader.locator('body').evaluate(() => window.scrollY)).toBe(beforeScroll);
        await parent.focus();
        await parent.press('Enter');
        await expect(alert).toHaveCount(0);
        await expect
          .poll(() => app.evaluate(() => Reflect.get(globalThis, 'openedPaths')))
          .toEqual([targetPath, nestedPath, join(directory, 'parent.sql'), docs]);

        for (const [name, message] of [
          ['目录也不存在', zh ? '移动、重命名或删除' : 'moved, renamed, or deleted'],
          ['危险类型', zh ? '不支持打开此类文件' : 'This file type is not supported'],
          ['危险协议', zh ? '链接地址无效' : 'invalid'],
        ]) {
          await reader.getByRole('link', { name, exact: true }).click();
          await expect(alert).toHaveCount(1);
          await expect(alert).toContainText(message);
          await expect(parent).toHaveCount(0);
        }
        await app.evaluate(() => {
          process.env.FUXIAN_E2E_LINK_DEFAULT_APP = '0';
        });
        await reader.getByRole('link', { name: '再次打开', exact: true }).click();
        await expect(alert).toContainText(zh ? '没有可打开' : 'No default app');
        await app.evaluate(() => {
          process.env.FUXIAN_E2E_LINK_DEFAULT_APP = '1';
          Reflect.set(globalThis, 'failOpen', true);
        });
        await reader.getByRole('link', { name: '再次打开', exact: true }).click();
        await expect(alert).toContainText(zh ? '系统未能打开' : 'system could not open');
        await rm(targetPath);
        await reader.getByRole('link', { name: '再次打开', exact: true }).click();
        await expect(alert).toContainText(zh ? '移动、重命名或删除' : 'moved, renamed, or deleted');
        await close.focus();
        await close.press('Enter');
        await expect(alert).toHaveCount(0);
        await app.evaluate(() => {
          delete process.env.FUXIAN_E2E_LINK_DEFAULT_APP;
          Reflect.set(globalThis, 'failOpen', false);
        });
        await reader.getByRole('link', { name: '原生关联', exact: true }).click();
        await expect
          .poll(() => app.evaluate(() => Reflect.get(globalThis, 'openedPaths')), {
            timeout: 15_000,
          })
          .toContain(join(docs, 'native.txt'));
        await expect(alert).toHaveCount(0);
        await expect(
          sidebar.getByRole('button', { name: 'README.md', exact: true }),
        ).toHaveAttribute('aria-current', 'page');
        await expect
          .poll(async () => JSON.parse(await readFile(sessionPath, 'utf8')).activeDocumentPath)
          .toBe(sourcePath);
        const saved = JSON.parse(await readFile(sessionPath, 'utf8'));
        expect(saved.openDocuments).toHaveLength(2);
        expect(saved.recentDocuments).toHaveLength(0);
        expect(await app.evaluate(() => Reflect.get(globalThis, 'openedUrls'))).toEqual([
          'https://example.com/report?q=1#section',
        ]);
      } finally {
        await app.close();
        await rm(directory, { recursive: true, force: true });
      }
    });
  }
}
