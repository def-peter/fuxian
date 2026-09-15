import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { captureElectronWindow } from './capture-window';

for (const locale of ['zh-CN', 'en-US']) {
  test(`about links and skill installation work without leaving settings (${locale})`, async () => {
    test.setTimeout(60_000);
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-about-'));
    const zh = locale === 'zh-CN';
    const app = await electron.launch({
      executablePath: createRequire(import.meta.url)('electron') as string,
      args: [resolve('apps/desktop')],
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FUXIAN_E2E_SYSTEM_LOCALE: locale,
        FUXIAN_E2E_UPDATE_SCENARIO: 'up-to-date',
        FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
        FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      },
    });
    try {
      await app.evaluate(({ shell, clipboard }) => {
        Reflect.set(globalThis, '__aboutUrls', []);
        shell.openExternal = async (url) => {
          Reflect.get(globalThis, '__aboutUrls').push(url);
        };
        clipboard.writeText = (text) => {
          Reflect.set(globalThis, '__aboutCopied', text);
        };
      });
      const reader = await app.firstWindow();
      await reader.getByRole('button', { name: zh ? '设置' : 'Settings', exact: true }).click();
      await expect.poll(() => app.windows().length).toBe(2);
      const settings = app.windows().find((page) => page.url().includes('view=settings'))!;
      await settings
        .getByRole('button', { name: zh ? '关于与更新' : 'About & Updates', exact: true })
        .click();
      const settingsUrl = settings.url();
      const links = [
        [zh ? '官网' : 'Website', `https://def-peter.github.io/fuxian/${zh ? 'zh' : 'en'}/`],
        ['GitHub', 'https://github.com/def-peter/fuxian'],
        [zh ? '反馈问题' : 'Report an issue', 'https://github.com/def-peter/fuxian/issues'],
      ];
      for (const [name, href] of links) {
        await expect(settings.getByRole('link', { name, exact: true })).toHaveAttribute(
          'href',
          href!,
        );
        await settings.getByRole('link', { name, exact: true }).click();
      }
      await expect
        .poll(() => app.evaluate(() => Reflect.get(globalThis, '__aboutUrls')))
        .toEqual(links.map(([, href]) => href));
      expect(settings.url()).toBe(settingsUrl);
      expect(app.windows()).toHaveLength(2);
      await expect(
        settings.getByRole('heading', {
          name: zh ? '图表创作 Skill' : 'Diagram authoring skill',
          exact: true,
        }),
      ).toHaveCount(0);
      await captureElectronWindow(app, settings, test.info().outputPath(`about-${locale}.png`));
      await settings.getByRole('button', { name: zh ? '扩展' : 'Extensions', exact: true }).click();
      await expect(
        settings.getByRole('heading', { name: zh ? '扩展' : 'Extensions', exact: true }),
      ).toBeVisible();
      await expect(settings.locator('[data-settings-surface="preview"]')).toHaveCount(0);
      const guide = settings.getByRole('link', {
        name: zh ? '使用指南' : 'Usage guide',
        exact: true,
      });
      const guideUrl = `https://github.com/def-peter/fuxian/blob/main/skills/fuxian-diagram/README${zh ? '.zh-CN' : ''}.md`;
      await expect(guide).toHaveAttribute('href', guideUrl);
      await guide.click();
      await expect
        .poll(() => app.evaluate(() => Reflect.get(globalThis, '__aboutUrls')))
        .toEqual([...links.map(([, href]) => href), guideUrl]);

      const install = settings.getByRole('button', {
        name: zh ? /^(查看|收起)安装步骤$/ : /^(Show|Hide) installation steps$/,
        exact: true,
      });
      await expect(install).toHaveAttribute('aria-expanded', 'false');
      await expect(settings.locator('code')).toHaveCount(0);
      await captureElectronWindow(
        app,
        settings,
        test.info().outputPath(`extensions-${locale}.png`),
      );
      await install.click();
      await expect(settings.locator('code')).toHaveText(
        'npx skills add def-peter/fuxian --skill fuxian-diagram',
      );
      await settings
        .getByRole('button', { name: zh ? '复制命令' : 'Copy command', exact: true })
        .click();
      await expect
        .poll(() => app.evaluate(() => Reflect.get(globalThis, '__aboutCopied')))
        .toBe('npx skills add def-peter/fuxian --skill fuxian-diagram');
      await expect(
        settings.getByRole('button', { name: zh ? '已复制' : 'Copied', exact: true }),
      ).toBeVisible();
      await install.click();
      await expect(settings.locator('code')).toHaveCount(0);
      await install.click();
      await app.evaluate(({ clipboard }) => {
        clipboard.writeText = () => {
          throw new Error('Test clipboard failure');
        };
      });
      await settings
        .getByRole('button', { name: zh ? '复制命令' : 'Copy command', exact: true })
        .click();
      await expect(
        settings.getByText(
          zh
            ? '复制失败，请选中命令手动复制。'
            : 'Could not copy. Select the command and copy it manually.',
        ),
      ).toBeVisible();
      await install.click();
      await install.click();
      await settings.setViewportSize({ width: 820, height: 620 });
      await settings.locator('code').scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          settings
            .getByRole('main')
            .evaluate((element) => element.scrollWidth <= element.clientWidth),
        )
        .toBe(true);
      await captureElectronWindow(
        app,
        settings,
        test.info().outputPath(`extensions-install-${locale}-narrow.png`),
      );
      await settings.getByRole('button', { name: zh ? '外观' : 'Appearance', exact: true }).click();
      await settings.getByRole('radio', { name: zh ? '深色' : 'Dark', exact: true }).click();
      await settings.getByRole('button', { name: zh ? '扩展' : 'Extensions', exact: true }).click();
      await expect(settings.locator('html')).toHaveClass(/dark/);
      await captureElectronWindow(
        app,
        settings,
        test.info().outputPath(`extensions-${locale}-dark.png`),
      );
      await settings
        .getByRole('button', { name: zh ? '关于与更新' : 'About & Updates', exact: true })
        .click();
      await reader.evaluate(() => window.fuxian.openSettings('extensions'));
      await expect(
        settings.getByRole('heading', { name: zh ? '扩展' : 'Extensions', exact: true }),
      ).toBeVisible();
      expect(app.windows()).toHaveLength(2);
    } finally {
      await app.close();
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });
}
