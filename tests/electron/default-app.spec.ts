import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
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
  status?: 'default' | 'not-default' | 'partial' | 'unavailable',
): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      ...(status ? { FUXIAN_E2E_DEFAULT_APP_STATUS: status } : {}),
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      NODE_ENV: 'test',
    },
  });

const openGeneralSettings = async (electronApp: ElectronApplication) => {
  const mainWindow = await electronApp.firstWindow();
  await mainWindow.getByRole('button', { name: '设置' }).click();
  await expect.poll(() => electronApp.windows().length).toBe(2);
  const settings = electronApp
    .windows()
    .find((window) => new URL(window.url()).searchParams.get('view') === 'settings');
  if (!settings) throw new Error('Settings window did not open.');
  await settings.getByRole('button', { name: '通用' }).click();
  return settings;
};

test('shows partial Markdown associations and opens guidance only on request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-default-app-partial-'));
  const electronApp = await launchDesktop(directory, 'partial');
  try {
    const settings = await openGeneralSettings(electronApp);
    await expect(settings.getByText('部分关联', { exact: true })).toBeVisible();
    await expect(settings.getByText('.md：浮现；.markdown：其他应用。')).toBeVisible();
    await settings.getByRole('button', { name: '设为 Markdown 默认应用' }).click();
    await expect(settings.getByText('测试适配器已模拟打开系统默认应用设置。')).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('does not offer to change associations when detection is unavailable in development', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-default-app-dev-'));
  const electronApp = await launchDesktop(directory);
  try {
    const settings = await openGeneralSettings(electronApp);
    await expect(settings.getByText('无法检测', { exact: true })).toBeVisible();
    await expect(settings.getByText(/开发模式不会检测或修改系统文件关联/)).toBeVisible();
    await expect(settings.getByRole('button', { name: '设为 Markdown 默认应用' })).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
