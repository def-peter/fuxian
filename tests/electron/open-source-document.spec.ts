import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourceDocumentPath = resolve(repositoryRoot, 'fixtures/basic.md');
const showcaseDocumentPath = resolve(repositoryRoot, 'fixtures/showcase.md');

const launchDesktop = async (sourcePath: string): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

test('a reader can open a source document from the start view', async () => {
  const electronApp = await launchDesktop(sourceDocumentPath);

  try {
    const window = await electronApp.firstWindow();

    await expect(window.getByRole('heading', { name: '浮现 Fuxian' })).toBeVisible();
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(
      finishedDocument.getByRole('heading', { level: 1, name: 'A finished document' }),
    ).toBeVisible();
    await expect(
      finishedDocument.getByText('Fuxian turns source text into something ready to read.'),
    ).toBeVisible();
    await expect(finishedDocument.getByRole('listitem')).toHaveText([
      'Clear structure',
      'Focused presentation',
    ]);
  } finally {
    await electronApp.close();
  }
});

test('a reader sees an actionable error when a source document cannot be read', async () => {
  const missingSourceDocumentPath = resolve(repositoryRoot, 'fixtures/missing.md');
  const electronApp = await launchDesktop(missingSourceDocumentPath);

  try {
    const window = await electronApp.firstWindow();

    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const error = window.getByRole('alert');
    await expect(error.getByRole('heading', { name: '无法打开文档' })).toBeVisible();
    await expect(error).toContainText('missing.md');
    await expect(error.getByRole('button', { name: '打开其他文档' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('a finished-document link opens outside the isolated preview', async () => {
  const electronApp = await launchDesktop(sourceDocumentPath);

  try {
    await electronApp.evaluate(({ shell }) => {
      const openedUrls: string[] = [];
      Object.defineProperty(globalThis, '__fuxianOpenedExternalUrls', {
        configurable: true,
        value: openedUrls,
      });
      shell.openExternal = async (url): Promise<void> => {
        openedUrls.push(url);
      };
    });

    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await finishedDocument.getByRole('link', { name: 'Fuxian website' }).click();

    await expect
      .poll(() =>
        electronApp.evaluate(
          () => Reflect.get(globalThis, '__fuxianOpenedExternalUrls') as unknown,
        ),
      )
      .toEqual(['https://example.com/fuxian']);
    await expect(
      finishedDocument.getByRole('heading', { name: 'A finished document' }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('the rich showcase renders safely and copies highlighted code', async () => {
  const electronApp = await launchDesktop(showcaseDocumentPath);

  try {
    await electronApp.evaluate(({ clipboard }) => clipboard.clear());

    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(
      finishedDocument.getByRole('heading', { name: '浮现 Fuxian 富文档展示' }),
    ).toBeVisible();
    await expect(finishedDocument.getByRole('table')).toBeVisible();
    await expect(finishedDocument.getByRole('checkbox')).toHaveCount(2);
    await expect(finishedDocument.getByText('title: Fuxian renderer showcase')).toHaveCount(0);
    await expect(finishedDocument.locator('code.hljs.language-typescript')).toBeVisible();
    expect(
      await finishedDocument.locator('body').evaluate(() => Reflect.get(globalThis, 'compromised')),
    ).toBeUndefined();

    await finishedDocument.getByRole('button', { name: '复制代码' }).first().click();
    await expect
      .poll(() => electronApp.evaluate(({ clipboard }) => clipboard.readText()))
      .toContain('type FinishedDocument');
  } finally {
    await electronApp.close();
  }
});
