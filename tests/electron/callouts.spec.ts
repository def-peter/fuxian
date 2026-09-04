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
const calloutFixturePath = resolve(repositoryRoot, 'fixtures/callouts.md');

test('renders restrained callout families in continuous and paper modes', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-callouts-'));
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: calloutFixturePath,
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[data-finished-document="active"]');
    const callouts = finishedDocument.locator('blockquote.callout');

    await expect(callouts).toHaveCount(8);
    await expect(finishedDocument.getByRole('note')).toHaveCount(8);
    await expect(finishedDocument.locator('blockquote:not(.callout)')).toHaveCount(1);
    await expect(
      finishedDocument.locator('[data-callout-type="warning"] .callout-header'),
    ).toContainText('发布前检查');
    await expect(
      finishedDocument.locator('[data-callout-source="architecture-decision"] .callout-header'),
    ).toHaveText('Architecture-Decision');

    const styles = await callouts.evaluateAll((elements) =>
      elements.map((element) => {
        const calloutStyle = getComputedStyle(element);
        const header = element.querySelector('.callout-header');
        const iconStyle = header ? getComputedStyle(header, '::before') : undefined;
        return {
          background: calloutStyle.backgroundColor,
          borderLeftWidth: calloutStyle.borderLeftWidth,
          iconContent: iconStyle?.content,
        };
      }),
    );
    expect(styles.every(({ borderLeftWidth }) => borderLeftWidth === '3px')).toBe(true);
    expect(styles.every(({ background }) => background !== 'rgba(0, 0, 0, 0)')).toBe(true);
    expect(styles.every(({ iconContent }) => iconContent && iconContent !== 'none')).toBe(true);
    expect(new Set(styles.map(({ background }) => background)).size).toBeGreaterThanOrEqual(6);

    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    await expect(window.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 20_000 });
    await expect(paper.getByText('不可信的脚本和危险链接会被阻止。')).toBeVisible();
    await expect(paper.locator('blockquote.callout').first()).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
