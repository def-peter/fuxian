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
  '--accent': '#eeeeef',
  '--background': '#f0f1f2',
  '--border': '#e4e6e8',
  '--card': '#fff',
  '--destructive': '#a8453d',
  '--foreground': '#24282c',
  '--input': '#8b969f',
  '--muted': '#f6f6f7',
  '--muted-foreground': '#626b74',
  '--primary': '#292d32',
  '--primary-foreground': '#fff',
  '--ring': '#1976c9',
  '--secondary': '#e9eef3',
  '--selected': '#e9eef3',
  '--success': '#59645f',
  '--warning': '#6d767e',
} as const;

const lightShellRoles = {
  '--border-control': '#8b969f',
  '--border-subtle': '#e4e6e8',
  '--focus-ring': '#1976c9',
  '--interactive-hover': '#eeeeef',
  '--interactive-selected': '#e9eef3',
  '--interactive-selected-foreground': '#2d3439',
  '--surface-overlay': '#fff',
  '--surface-panel': '#fff',
  '--surface-shell': '#f0f1f2',
  '--surface-sidebar': '#f6f6f7',
  '--surface-stage': '#f0f1f2',
  '--surface-toolbar': '#fff',
  '--text-primary': '#24282c',
  '--text-secondary': '#626b74',
} as const;

const shadcnAliases = {
  '--accent': '--interactive-hover',
  '--background': '--surface-shell',
  '--border': '--border-subtle',
  '--card': '--surface-panel',
  '--foreground': '--text-primary',
  '--input': '--border-control',
  '--muted': '--surface-sidebar',
  '--muted-foreground': '--text-secondary',
  '--ring': '--focus-ring',
  '--selected': '--interactive-selected',
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

test('applies one semantic light palette to every shell window', async () => {
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

    const resolvedShellRoles = await readerWindow.evaluate((tokens) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        tokens.map((token) => [token, style.getPropertyValue(token).trim()]),
      );
    }, Object.keys(lightShellRoles));
    expect(resolvedShellRoles).toEqual(lightShellRoles);

    const resolvedAliases = await readerWindow.evaluate((aliases) => {
      const style = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        Object.entries(aliases).map(([alias, role]) => [
          alias,
          [style.getPropertyValue(alias).trim(), style.getPropertyValue(role).trim()],
        ]),
      );
    }, shadcnAliases);
    for (const values of Object.values(resolvedAliases)) expect(values[0]).toBe(values[1]);

    await expect(readerWindow.getByRole('complementary', { name: '文档会话' })).toHaveCSS(
      'background-color',
      'rgb(246, 246, 247)',
    );
    await expect(readerWindow.locator('[data-reader-toolbar]')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    const activeDocumentButton = readerWindow.getByRole('button', {
      exact: true,
      name: 'shell-palette.md',
    });
    await expect(
      readerWindow.getByRole('complementary', { name: '文档会话' }).getByText('浮现'),
    ).toHaveCSS('color', 'rgb(36, 40, 44)');
    await expect(activeDocumentButton).toHaveCSS('color', 'rgb(45, 52, 57)');
    await expect(activeDocumentButton.locator('..')).toHaveCSS(
      'background-color',
      'rgb(233, 238, 243)',
    );

    await readerWindow.getByRole('button', { name: '设置' }).click();
    await expect.poll(() => electronApp.windows().length).toBe(2);
    const settingsWindow = electronApp
      .windows()
      .find((page) => new URL(page.url()).searchParams.get('view') === 'settings');
    if (!settingsWindow) throw new Error('Settings window did not open.');
    await settingsWindow.waitForLoadState('domcontentloaded');
    const settingsRoot = settingsWindow.locator('[data-settings-window]');
    const settingsBackground = await settingsWindow.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--background').trim(),
    );
    expect(settingsBackground).toBe(lightPalette['--background']);
    const settingsRoles = await settingsRoot.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        aliasBackground: style.getPropertyValue('--background').trim(),
        aliasMuted: style.getPropertyValue('--muted').trim(),
        focusRing: style.getPropertyValue('--focus-ring').trim(),
        surfaceShell: style.getPropertyValue('--surface-shell').trim(),
        surfaceSidebar: style.getPropertyValue('--surface-sidebar').trim(),
        textSecondary: style.getPropertyValue('--text-secondary').trim(),
      };
    });
    expect(settingsRoles).toEqual({
      aliasBackground: '#f0f1f2',
      aliasMuted: '#f6f6f7',
      focusRing: '#1976c9',
      surfaceShell: '#f0f1f2',
      surfaceSidebar: '#f6f6f7',
      textSecondary: '#626b74',
    });
    expect(contrastRatio(settingsRoles.textSecondary, settingsRoles.surfaceShell)).toBeGreaterThan(
      4.5,
    );
    expect(
      contrastRatio(settingsRoles.textSecondary, settingsRoles.surfaceSidebar),
    ).toBeGreaterThan(4.5);
    await expect(settingsWindow.locator('[data-settings-surface="header"]')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(settingsWindow.getByRole('navigation', { name: '设置分区' })).toHaveCSS(
      'background-color',
      'rgb(246, 246, 247)',
    );
    await expect(settingsWindow.locator('[data-settings-surface="form"]')).toHaveCSS(
      'background-color',
      'rgb(255, 255, 255)',
    );
    await expect(settingsWindow.locator('[data-settings-surface="preview"]')).toHaveCSS(
      'background-color',
      'rgb(240, 241, 242)',
    );

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
