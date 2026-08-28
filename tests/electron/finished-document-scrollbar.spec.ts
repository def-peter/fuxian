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

test('finished-document scrollbar stays scoped, quiet, and stable while scrolling', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-scrollbar-'));
  const sourcePath = join(directory, 'long-document.md');
  const preferencesPath = join(directory, 'preferences.json');
  await writeFile(
    sourcePath,
    [
      '# Scrollbar behavior',
      ...Array.from(
        { length: 100 },
        (_, index) => `\n## Section ${index + 1}\n\nFinished document paragraph ${index + 1}.`,
      ),
    ].join('\n'),
  );
  await writeFile(preferencesPath, JSON.stringify(createDefaultReaderPreferences()));
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
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.emulateMedia({ colorScheme: 'light' });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const frame = window.frameLocator('iframe[title="Finished document"]');
    const root = frame.locator('html');
    await expect(frame.getByRole('heading', { name: 'Scrollbar behavior' })).toBeVisible();
    await expect(root).toHaveAttribute('data-appearance', 'light');
    await expect.poll(() => root.getAttribute('data-scroll-active')).toBeNull();

    const idleState = await root.evaluate((element) => {
      const style = getComputedStyle(element);
      const probe = document.createElement('span');
      probe.style.color = 'var(--document-scrollbar-thumb-idle)';
      document.body.append(probe);
      const resolvedThumbColor = getComputedStyle(probe).color;
      probe.remove();
      return {
        clientWidth: element.clientWidth,
        resolvedThumbColor,
        scrollable: element.scrollHeight > innerHeight,
        thumbToken: style.getPropertyValue('--document-scrollbar-thumb-idle'),
      };
    });
    expect(idleState.scrollable).toBe(true);
    expect(idleState.thumbToken).toContain('color-mix');
    expect(idleState.thumbToken).toContain('12%');
    expect(
      await window
        .locator('html')
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue('--document-scrollbar-thumb-idle'),
        ),
    ).toBe('');
    await frame.locator('body').evaluate(() => scrollTo({ top: 600 }));
    await expect(root).toHaveAttribute('data-scroll-active', 'true');
    expect(await root.evaluate((element) => element.clientWidth)).toBe(idleState.clientWidth);
    await expect.poll(() => root.getAttribute('data-scroll-active'), { timeout: 2_000 }).toBeNull();

    await window.emulateMedia({ colorScheme: 'dark' });
    await expect(root).toHaveAttribute('data-appearance', 'dark');
    const darkThumbColor = await root.evaluate(() => {
      const probe = document.createElement('span');
      probe.style.color = 'var(--document-scrollbar-thumb-idle)';
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    });
    expect(darkThumbColor).not.toBe(idleState.resolvedThumbColor);
    await window.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
    await expect
      .poll(() => root.evaluate((element) => getComputedStyle(element).scrollbarColor))
      .toBe('auto');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
