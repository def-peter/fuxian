import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('exports private local diagnostics and clears them without changing the document session', async () => {
  const testInfo = test.info();
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-diagnostics-e2e-'));
  const paths = [join(directory, '私密清单.md'), join(directory, '私人资料.md')];
  await Promise.all(paths.map((path) => writeFile(path, '# Private heading\n\nSECRET-BODY')));
  const exportPath = join(directory, 'diagnostics.jsonl');
  const sessionPath = join(directory, 'session.json');
  const app = await electron.launch({
    executablePath: createRequire(import.meta.url)('electron') as string,
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FUXIAN_E2E_SESSION_FILE: sessionPath,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SOURCE_DRAFTS_FILE: join(directory, 'drafts.json'),
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify(paths),
    },
  });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: '打开 Markdown', exact: true }).click();
    const items = page.getByRole('button', { name: /^关闭“/ });
    await expect(items).toHaveCount(2);
    await expect
      .poll(
        async () =>
          JSON.parse(await readFile(sessionPath, 'utf8').catch(() => '{}')).openDocuments?.length,
      )
      .toBe(2);
    await app.evaluate(({ Menu, BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]!;
      Menu.getApplicationMenu()!
        .getMenuItemById('close-active-document')!
        .click(undefined as never, window, window.webContents);
    });
    await expect(items).toHaveCount(1);
    await expect
      .poll(async () => JSON.parse(await readFile(sessionPath, 'utf8')).openDocuments.length)
      .toBe(1);
    await page.evaluate(() => {
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: new Error(
            'SECRET-BODY /Users/private/私密清单.md https://user:password@private.host',
          ),
        }),
      );
    });
    // Exercise Electron's termination notification without crashing a native
    // process and potentially opening an OS crash dialog on the user's display.
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0]!.webContents.emit(
        'render-process-gone',
        {},
        { reason: 'crashed', exitCode: 1 },
      );
    });
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await expect.poll(() => app.windows().length).toBe(2);
    const settings = app.windows().find((window) => window.url().includes('view=settings'))!;
    await settings.getByRole('button', { name: '关于与更新', exact: true }).click();
    await settings
      .getByRole('button', { name: '导出诊断日志', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(settings.getByText(/本机保留最近 7 天/)).toBeVisible();
    await settings.screenshot({ path: testInfo.outputPath('diagnostics-zh.png') });
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, exportPath);
    await settings.getByRole('button', { name: '导出诊断日志', exact: true }).click();
    await expect(settings.getByText('日志已导出，你可以在反馈问题时附上此文件。')).toBeVisible();
    const text = await readFile(exportPath, 'utf8');
    for (const secret of [
      'SECRET-BODY',
      'Private heading',
      '私密清单',
      '私人资料',
      directory,
      '/Users/private',
      'password',
      'private.host',
    ])
      expect(text).not.toContain(secret);
    const records = text
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'document.closed', origin: 'command' }),
        expect.objectContaining({
          event: 'session.accepted',
          previousOpenCount: 2,
          openCount: 1,
          recentCount: 1,
        }),
        expect.objectContaining({ event: 'renderer.error' }),
        expect.objectContaining({ event: 'renderer.process-gone', reason: 'crashed' }),
      ]),
    );
    const closed = records.find((record) => record.event === 'document.closed');
    const changed = records.find(
      (record) => record.event === 'session.accepted' && record.openCount === 1,
    );
    expect(changed.removedOpen).toContain(closed.document);
    expect(
      records.some(
        (record) => record.event === 'session.saved' && record.revision === changed.revision,
      ),
    ).toBe(true);

    await settings.getByRole('button', { name: '通用', exact: true }).click();
    await settings.getByRole('radio', { name: 'English', exact: true }).click();
    await settings.getByRole('button', { name: 'About & Updates', exact: true }).click();
    await settings
      .getByRole('button', { name: 'Export logs', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(settings.getByText(/Local logs: up to 7 days/)).toBeVisible();
    await settings.screenshot({ path: testInfo.outputPath('diagnostics-en.png') });
    const before = JSON.parse(await readFile(sessionPath, 'utf8'));
    await settings.getByRole('button', { name: 'Clear logs', exact: true }).click();
    await expect(
      settings.getByText('Logs cleared. Your documents and viewing history are unchanged.'),
    ).toBeVisible();
    await settings.getByRole('button', { name: 'Export logs', exact: true }).click();
    await expect(
      settings.getByText('Logs exported. You can attach this file when reporting a problem.'),
    ).toBeVisible();
    expect(await readFile(exportPath, 'utf8')).not.toContain('document.closed');
    expect(JSON.parse(await readFile(sessionPath, 'utf8'))).toEqual(before);
    expect(await readFile(paths[0]!, 'utf8')).toContain('SECRET-BODY');

    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' });
    });
    await settings.getByRole('button', { name: 'Export logs', exact: true }).click();
    await expect(settings.getByRole('button', { name: 'Export logs', exact: true })).toBeEnabled();
    await expect(settings.getByRole('alert')).not.toContainText('Could not export or clear logs');
    await app.evaluate(
      ({ dialog }, path) => {
        dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
      },
      join(directory, 'missing-directory', 'diagnostics.jsonl'),
    );
    await settings.getByRole('button', { name: 'Export logs', exact: true }).click();
    await expect(settings.getByText('Could not export or clear logs')).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Export logs', exact: true })).toBeEnabled();
    const logsDirectory = join(`${sessionPath}.user-data`, 'diagnostics-development');
    expect((await readdir(logsDirectory)).includes('running')).toBe(true);
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
