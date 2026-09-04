import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const configuredExecutable = process.env.FUXIAN_PACKAGED_EXECUTABLE;

const waitForSecondaryInstance = async (executable: string, args: string[]): Promise<void> => {
  const secondary = spawn(executable, args, { env: process.env, stdio: 'ignore' });
  await new Promise<void>((resolveExit, rejectExit) => {
    const timeout = setTimeout(() => {
      secondary.kill();
      rejectExit(new Error('The packaged secondary instance did not exit.'));
    }, 15_000);
    secondary.once('error', (error) => {
      clearTimeout(timeout);
      rejectExit(error);
    });
    secondary.once('exit', () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
};

test('the packaged application is isolated, forwards open requests, and restores its session', async () => {
  test.skip(!configuredExecutable, 'Set FUXIAN_PACKAGED_EXECUTABLE after packaging.');
  const executable = resolve(configuredExecutable ?? '');
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-packaged-smoke-'));
  const userDataDirectory = join(temporaryDirectory, 'user-data');
  const firstPath = join(temporaryDirectory, 'first.md');
  const secondPath = join(temporaryDirectory, 'second.markdown');
  const userDataArgument = `--user-data-dir=${userDataDirectory}`;
  await writeFile(firstPath, '# First packaged document\n\nReady to read.');
  await writeFile(secondPath, '# Second packaged document\n\nForwarded to the primary instance.');
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await electron.launch({
      executablePath: executable,
      args: [userDataArgument, firstPath],
    });
    let window = await electronApp.firstWindow();
    await expect(
      window
        .frameLocator('iframe[data-finished-document="active"]')
        .getByRole('heading', { name: 'First packaged document' }),
    ).toBeVisible();
    await expect
      .poll(() =>
        electronApp?.evaluate(({ BrowserWindow, app }) => {
          const browserWindow = BrowserWindow.getAllWindows()[0];
          const preferences = browserWindow?.webContents.getLastWebPreferences();
          return {
            autoHideMenuBar: browserWindow?.isMenuBarAutoHide(),
            contextIsolation: preferences?.contextIsolation,
            isPackaged: app.isPackaged,
            menuBarVisible: browserWindow?.isMenuBarVisible(),
            nodeIntegration: preferences?.nodeIntegration,
            sandbox: preferences?.sandbox,
          };
        }),
      )
      .toEqual({
        autoHideMenuBar: false,
        contextIsolation: true,
        isPackaged: true,
        menuBarVisible: process.platform !== 'win32',
        nodeIntegration: false,
        sandbox: true,
      });
    await expect(window.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
      'content',
      /script-src 'self';.*connect-src 'self';/,
    );

    await waitForSecondaryInstance(executable, [userDataArgument, secondPath, firstPath]);
    const session = window.getByRole('complementary', { name: '文档会话' });
    await expect(session.getByRole('button', { exact: true, name: 'first.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'second.markdown' })).toHaveCount(
      1,
    );
    await expect(
      session.getByRole('button', { exact: true, name: 'second.markdown' }),
    ).toHaveAttribute('aria-current', 'page');
    await window.waitForTimeout(300);
    await electronApp.close();

    electronApp = await electron.launch({ executablePath: executable, args: [userDataArgument] });
    window = await electronApp.firstWindow();
    await expect(
      window.getByRole('complementary', { name: '文档会话' }).getByRole('button', {
        exact: true,
        name: 'second.markdown',
      }),
    ).toHaveAttribute('aria-current', 'page');
  } finally {
    await electronApp?.close().catch(() => undefined);
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
