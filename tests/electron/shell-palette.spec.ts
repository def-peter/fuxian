import { _electron as electron, expect, test } from '@playwright/test';
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

const lightPalette = {
  '--accent': '#e7ebee',
  '--background': '#e9edf0',
  '--border': '#d6dce1',
  '--card': '#fff',
  '--destructive': '#a8453d',
  '--foreground': '#25292d',
  '--input': '#8b969f',
  '--muted': '#f2f5f7',
  '--muted-foreground': '#626b74',
  '--primary': '#292d32',
  '--primary-foreground': '#fff',
  '--ring': '#5b6672',
  '--secondary': '#e0e5e9',
  '--selected': '#e0e5e9',
  '--success': '#59645f',
  '--warning': '#6d767e',
} as const;

const relativeLuminance = (hex: string): number => {
  const normalized =
    hex.length === 4 ? `#${[...hex.slice(1)].map((channel) => channel.repeat(2)).join('')}` : hex;
  const channels = normalized
    .match(/[\da-f]{2}/gi)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
};

const contrastRatio = (first: string, second: string): number => {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort(
    (a, b) => b - a,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
};

test('applies the selected cool-neutral palette to every light shell window', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-shell-palette-'));
  const sourcePath = join(directory, 'shell-palette.md');
  const preferencesPath = join(directory, 'preferences.json');
  await writeFile(
    sourcePath,
    '# Shell palette\n\nThe finished document remains the visual center.',
  );
  await writeFile(
    preferencesPath,
    JSON.stringify({ ...createDefaultReaderPreferences(), appearance: 'light' }),
  );

  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();

    const resolvedPalette = await readerWindow.evaluate((tokens) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        tokens.map((token) => [token, style.getPropertyValue(token).trim()]),
      );
    }, Object.keys(lightPalette));
    expect(resolvedPalette).toEqual(lightPalette);

    await expect(readerWindow.getByRole('complementary', { name: '文档会话' })).toHaveCSS(
      'background-color',
      'rgb(242, 245, 247)',
    );
    await expect(readerWindow.locator('[data-reader-toolbar]')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    const activeDocumentButton = readerWindow.getByRole('button', {
      exact: true,
      name: 'shell-palette.md',
    });
    await expect(activeDocumentButton).toHaveCSS('color', 'rgb(37, 41, 45)');
    await expect(activeDocumentButton.locator('..')).toHaveCSS(
      'background-color',
      'rgb(224, 229, 233)',
    );

    await readerWindow.getByRole('button', { name: '设置' }).click();
    await expect.poll(() => electronApp.windows().length).toBe(2);
    const settingsWindow = electronApp
      .windows()
      .find((page) => new URL(page.url()).searchParams.get('view') === 'settings');
    if (!settingsWindow) throw new Error('Settings window did not open.');
    await settingsWindow.waitForLoadState('domcontentloaded');
    const settingsBackground = await settingsWindow.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    );
    expect(settingsBackground).toBe(lightPalette['--background']);

    expect(
      contrastRatio(lightPalette['--foreground'], lightPalette['--background']),
    ).toBeGreaterThan(4.5);
    expect(
      contrastRatio(lightPalette['--muted-foreground'], lightPalette['--muted']),
    ).toBeGreaterThan(4.5);
    expect(
      contrastRatio(lightPalette['--primary'], lightPalette['--primary-foreground']),
    ).toBeGreaterThan(4.5);
    expect(contrastRatio(lightPalette['--input'], lightPalette['--card'])).toBeGreaterThan(3);
    expect(contrastRatio(lightPalette['--ring'], lightPalette['--card'])).toBeGreaterThan(3);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
