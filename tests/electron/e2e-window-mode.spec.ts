import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('E2E windows render without appearing or taking system focus by default', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-window-mode-'));
  const sourcePath = join(directory, 'hidden-window.md');
  await writeFile(sourcePath, '# Hidden E2E window\n\nRendered in the background.');
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
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('button', { name: '打开 Markdown' }).click();
    await page.getByRole('button', { name: '设置' }).click();
    await expect.poll(() => electronApp.windows().length).toBe(2);
    const state = await electronApp.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().map((window) => ({
        backgroundThrottling: window.webContents.getBackgroundThrottling(),
        focused: window.isFocused(),
        settings: window.webContents.getURL().includes('view=settings'),
        visible: window.isVisible(),
      })),
    );

    expect(state).toEqual(
      expect.arrayContaining([
        {
          backgroundThrottling: false,
          focused: false,
          settings: false,
          visible: false,
        },
        {
          backgroundThrottling: false,
          focused: false,
          settings: true,
          visible: false,
        },
      ]),
    );
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
