import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

const launchDesktop = (
  directory: string,
  systemLocale: string,
  options: { preferences?: unknown; sourceDocument?: string } = {},
): Promise<ElectronApplication> => {
  const preferencesPath = join(directory, 'preferences.json');
  const prepare = options.preferences
    ? writeFile(preferencesPath, `${JSON.stringify(options.preferences)}\n`, 'utf8')
    : Promise.resolve();
  return prepare.then(() =>
    electron.launch({
      executablePath: electronPath,
      args: [desktopAppPath],
      env: {
        ...process.env,
        FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
        FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
        FUXIAN_E2E_SYSTEM_LOCALE: systemLocale,
        ...(options.sourceDocument ? { FUXIAN_E2E_SOURCE_DOCUMENT: options.sourceDocument } : {}),
        NODE_ENV: 'test',
      },
    }),
  );
};

const closeAndRemove = async (app: ElectronApplication, directory: string): Promise<void> => {
  await app.close();
  await rm(directory, { force: true, recursive: true });
};

test('follows any Chinese system locale by default', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-localization-zh-'));
  const app = await launchDesktop(directory, 'zh-Hant-TW');
  try {
    const window = await app.firstWindow();
    await expect(window.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(window.getByRole('heading', { name: '浮现' })).toBeVisible();
    const chrome = await app.evaluate(({ Menu, app }) => ({
      appName: app.name,
      labels: Menu.getApplicationMenu()?.items.map((item) => item.label),
    }));
    expect(chrome.appName).toBe('浮现');
    expect(chrome.labels).toContain('文件');
  } finally {
    await closeAndRemove(app, directory);
  }
});

test('uses English for non-Chinese and unknown system locales', async () => {
  for (const systemLocale of ['en-GB', '']) {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-localization-en-'));
    const app = await launchDesktop(directory, systemLocale);
    try {
      const window = await app.firstWindow();
      await expect(window.locator('html')).toHaveAttribute('lang', 'en-US');
      await expect(window.getByRole('heading', { name: 'Fuxian' })).toBeVisible();
      const chrome = await app.evaluate(({ Menu, app }) => ({
        appName: app.name,
        labels: Menu.getApplicationMenu()?.items.map((item) => item.label),
      }));
      expect(chrome.appName).toBe('Fuxian');
      expect(chrome.labels).toContain('File');
    } finally {
      await closeAndRemove(app, directory);
    }
  }
});

test('manual language selection applies live, persists, and never translates document content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-localization-live-'));
  const sourcePath = join(directory, '中文文档.md');
  const source = '# 中文标题\n\n这是不应被翻译的正文。\n';
  await writeFile(sourcePath, source, 'utf8');
  const app = await launchDesktop(directory, 'zh-CN', { sourceDocument: sourcePath });

  try {
    await app.evaluate(({ shell }) => {
      const openedUrls: string[] = [];
      Object.defineProperty(globalThis, '__fuxianOpenedExternalUrls', {
        configurable: true,
        value: openedUrls,
      });
      shell.openExternal = async (url): Promise<void> => {
        openedUrls.push(url);
      };
    });

    const reader = await app.firstWindow();
    await reader.getByRole('button', { name: '打开 Markdown' }).click();
    await expect(reader.locator('iframe[title="完成文档"]')).toHaveCount(1);
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: '中文标题' }),
    ).toBeVisible();
    await reader.getByRole('button', { name: '设置' }).click();
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app
      .windows()
      .find((window) => new URL(window.url()).searchParams.get('view') === 'settings');
    if (!settings) throw new Error('Settings window did not open.');
    await settings.getByRole('button', { name: '通用', exact: true }).click();
    await settings.getByRole('radio', { name: 'English', exact: true }).click();

    await expect(reader.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(reader.locator('iframe[title="Finished document"]')).toHaveCount(1);
    await expect(settings.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(reader.getByText('中文文档.md', { exact: true }).first()).toBeVisible();
    await expect(
      reader.frameLocator('iframe').getByRole('heading', { name: '中文标题' }),
    ).toBeVisible();
    await expect(reader.frameLocator('iframe').getByText('这是不应被翻译的正文。')).toBeVisible();
    await reader.getByRole('radio', { name: 'Paper preview' }).click();
    const paper = reader.frameLocator('iframe[title="Paper preview"]');
    await expect(paper.locator('html')).toHaveAttribute('lang', 'en-US');
    await expect(paper.locator('.paper-preview-pages')).toHaveAttribute(
      'aria-label',
      'Paginated finished document',
    );
    await expect(paper.getByRole('heading', { name: '中文标题' })).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(() =>
        app.evaluate(() => Reflect.get(globalThis, '__fuxianOpenedExternalUrls') as unknown),
      )
      .toEqual([]);
    await expect
      .poll(async () => JSON.parse(await readFile(join(directory, 'preferences.json'), 'utf8')))
      .toMatchObject({ language: 'en-US' });
    await expect.poll(() => readFile(sourcePath, 'utf8')).toBe(source);

    const chrome = await app.evaluate(({ Menu, app }) => ({
      appName: app.name,
      labels: Menu.getApplicationMenu()?.items.map((item) => item.label),
    }));
    expect(chrome.appName).toBe('Fuxian');
    expect(chrome.labels).toContain('File');
  } finally {
    await closeAndRemove(app, directory);
  }
});

test('manual Chinese preference overrides an English system locale', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-localization-override-'));
  const app = await launchDesktop(directory, 'en-US', {
    preferences: { language: 'zh-CN', version: 1 },
  });
  try {
    const window = await app.firstWindow();
    await expect(window.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(window.getByRole('heading', { name: '浮现' })).toBeVisible();
  } finally {
    await closeAndRemove(app, directory);
  }
});

test('English settings labels stay within their controls', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-localization-layout-'));
  const app = await launchDesktop(directory, 'en-US');

  try {
    const reader = await app.firstWindow();
    await reader.getByRole('button', { name: 'Settings' }).click();
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app
      .windows()
      .find((window) => new URL(window.url()).searchParams.get('view') === 'settings');
    if (!settings) throw new Error('Settings window did not open.');

    await expect(settings.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    const overflowingNavigationItems = await settings
      .getByRole('navigation', { name: 'Settings sections' })
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons
          .filter((button) => button.scrollWidth > button.clientWidth)
          .map((button) => ({
            available: button.clientWidth,
            label: button.textContent?.trim(),
            required: button.scrollWidth,
          })),
      );
    expect.soft(overflowingNavigationItems).toEqual([]);

    const colorMode = settings.locator('[data-slot="segmented-control"][aria-label="Color mode"]');
    const overflowingColorModeItems = await colorMode.evaluate((control) => {
      const controlBox = control.getBoundingClientRect();
      return [...control.children]
        .filter((item) => {
          const itemBox = item.getBoundingClientRect();
          return itemBox.left < controlBox.left || itemBox.right > controlBox.right;
        })
        .map((item) => ({
          controlRight: controlBox.right,
          itemRight: item.getBoundingClientRect().right,
          label: item.textContent?.trim(),
        }));
    });
    expect.soft(overflowingColorModeItems).toEqual([]);

    await settings.getByRole('button', { name: 'PlantUML', exact: true }).click();
    await expect(settings.getByRole('heading', { name: 'PlantUML' })).toBeVisible();
    const plantUmlFormWidth = await settings
      .locator('[data-settings-surface="form"]')
      .evaluate((form) => ({
        clientWidth: form.clientWidth,
        scrollWidth: form.scrollWidth,
      }));
    expect(plantUmlFormWidth.scrollWidth).toBeLessThanOrEqual(plantUmlFormWidth.clientWidth);
  } finally {
    await closeAndRemove(app, directory);
  }
});
