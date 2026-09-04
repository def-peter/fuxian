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

test('renders visible emphasis in continuous and paper modes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-emphasis-'));
  const sourcePath = join(directory, 'emphasis.md');
  await writeFile(
    sourcePath,
    '# Emphasis\n\n普通中文，*还没有发生的清晨*。\n\nEnglish *visible italic* text.',
  );
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
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[data-finished-document="active"]');
    const emphasis = finishedDocument.locator('em');

    await expect(emphasis).toHaveCount(2);
    await expect(emphasis.first()).toHaveCSS('font-style', 'italic');
    await expect(emphasis.first()).not.toHaveCSS('font-synthesis', 'none');

    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paperEmphasis = window.frameLocator('iframe[title="纸张预览"]').locator('em');
    await expect(paperEmphasis).toHaveCount(2);
    await expect(paperEmphasis.first()).toHaveCSS('font-style', 'italic');
    await expect(paperEmphasis.first()).not.toHaveCSS('font-synthesis', 'none');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
