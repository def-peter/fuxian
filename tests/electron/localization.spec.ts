import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

test('uses Chinese application chrome while Chinese is the only locale', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-localization-'));
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await expect.poll(() => window.title()).toBe('浮现');
    await expect(window.getByRole('heading', { name: '浮现' })).toBeVisible();
    await expect(window.getByText('Fuxian', { exact: false })).toHaveCount(0);

    const { appName, labels } = await electronApp.evaluate(({ Menu, app }) => ({
      appName: app.name,
      labels: Menu.getApplicationMenu()?.items.map((item) => item.label),
    }));
    expect(appName).toBe('浮现');
    expect(labels).toEqual(
      process.platform === 'darwin'
        ? ['浮现', '文件', '编辑', '视图', '窗口', '帮助']
        : ['文件', '编辑', '视图', '窗口', '帮助'],
    );
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
