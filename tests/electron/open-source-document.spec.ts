import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
    await expect(
      finishedDocument.getByRole('img', {
        name: 'Source document 到 finished document 的阅读流程',
      }),
    ).toBeVisible();
    await expect(
      finishedDocument
        .locator('[data-resource-source="assets/missing-preview.png"]')
        .getByText('无法加载图片'),
    ).toBeVisible();
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

test('local images stay inside the source-document trust scope and can retry', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-resource-'));
  const documentDirectory = join(temporaryDirectory, 'document');
  const nestedAssetsDirectory = join(documentDirectory, 'assets', 'nested');
  const sourcePath = join(documentDirectory, 'resources.md');
  const missingImagePath = join(documentDirectory, 'assets', 'missing.png');
  const outsideImagePath = join(temporaryDirectory, 'outside.png');
  const validPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );

  await mkdir(nestedAssetsDirectory, { recursive: true });
  await writeFile(join(nestedAssetsDirectory, 'pixel.png'), validPng);
  await writeFile(join(documentDirectory, 'assets', 'broken.png'), 'not an image');
  await writeFile(outsideImagePath, validPng);
  await writeFile(
    sourcePath,
    [
      '# Local resources',
      '![Authorized](assets/nested/pixel.png)',
      '![Missing](assets/missing.png)',
      '![Broken](assets/broken.png)',
      '![Traversal](../outside.png)',
      `![Absolute](${outsideImagePath})`,
    ].join('\n\n'),
  );

  const electronApp = await launchDesktop(sourcePath);
  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');

    const authorizedImage = finishedDocument.getByRole('img', { name: 'Authorized' });
    await authorizedImage.scrollIntoViewIfNeeded();
    await expect(authorizedImage).toBeVisible();
    await expect(authorizedImage).toHaveAttribute('src', /^fuxian-resource:\/\//);
    await expect(finishedDocument.locator('img[src^="file:"]')).toHaveCount(0);

    const missingResource = finishedDocument.locator('[data-resource-source="assets/missing.png"]');
    await missingResource.scrollIntoViewIfNeeded();
    await expect(missingResource.getByText('无法加载图片')).toBeVisible();
    await expect(missingResource.locator('img')).toBeHidden();
    await writeFile(missingImagePath, validPng);
    await missingResource.getByRole('button', { name: '重试' }).click();
    await expect
      .poll(() =>
        missingResource.locator('img').evaluate((image: HTMLImageElement) => ({
          hidden: image.hidden,
          naturalWidth: image.naturalWidth,
        })),
      )
      .toEqual({ hidden: false, naturalWidth: 1 });

    const brokenResource = finishedDocument.locator('[data-resource-source="assets/broken.png"]');
    await brokenResource.scrollIntoViewIfNeeded();
    await expect(brokenResource.getByText('无法加载图片')).toBeVisible();
    await expect(brokenResource.locator('img')).toBeHidden();
    await expect(brokenResource.getByRole('button', { name: '重试' })).toBeVisible();

    await expect(
      finishedDocument.locator('[data-resource-source="../outside.png"] img'),
    ).toHaveCount(0);
    await expect(
      finishedDocument
        .locator('[data-resource-source="../outside.png"]')
        .getByText('图片路径超出了文档的授权范围。'),
    ).toBeVisible();
    await expect(
      finishedDocument.locator(`[data-resource-source="${outsideImagePath}"] img`),
    ).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
