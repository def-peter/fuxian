import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourceDocumentPath = resolve(repositoryRoot, 'fixtures/basic.md');
const showcaseDocumentPath = resolve(repositoryRoot, 'fixtures/showcase.md');
const disposablePreferencesFiles = new Set<string>();
const disposableSessionFiles = new Set<string>();

interface LaunchDesktopOptions {
  commandLineSourcePaths?: string[];
  locateSourcePath?: string;
  preferencesFilePath?: string;
  sessionFilePath?: string;
}

const launchDesktop = async (
  sourcePath: string | string[],
  options: LaunchDesktopOptions = {},
): Promise<ElectronApplication> => {
  const sessionFilePath =
    options.sessionFilePath ?? join(tmpdir(), `fuxian-e2e-session-${randomUUID()}.json`);
  if (!options.sessionFilePath) {
    disposableSessionFiles.add(sessionFilePath);
  }
  const preferencesFilePath =
    options.preferencesFilePath ?? join(tmpdir(), `fuxian-e2e-preferences-${randomUUID()}.json`);
  if (!options.preferencesFilePath) {
    disposablePreferencesFiles.add(preferencesFilePath);
  }
  return electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath, ...(options.commandLineSourcePaths ?? [])],
    env: {
      ...process.env,
      ...(options.locateSourcePath
        ? { FUXIAN_E2E_LOCATE_SOURCE_DOCUMENT: options.locateSourcePath }
        : {}),
      FUXIAN_E2E_PREFERENCES_FILE: preferencesFilePath,
      FUXIAN_E2E_SESSION_FILE: sessionFilePath,
      FUXIAN_E2E_SOURCE_DOCUMENT: typeof sourcePath === 'string' ? sourcePath : sourcePath[0],
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify(
        typeof sourcePath === 'string' ? [sourcePath] : sourcePath,
      ),
      NODE_ENV: 'test',
    },
  });
};

test.afterAll(async () => {
  await Promise.all([
    ...[...disposablePreferencesFiles, ...disposableSessionFiles].map((path) =>
      rm(path, { force: true }),
    ),
    ...[...disposableSessionFiles].map((path) =>
      rm(`${path}.user-data`, { force: true, recursive: true }),
    ),
  ]);
});

test('restores open-document order, active document, and reading position after restart', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-restart-'));
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  const launchOptions = { sessionFilePath };
  let electronApp = await launchDesktop([sourceDocumentPath, showcaseDocumentPath], launchOptions);

  try {
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const session = window.getByRole('complementary', { name: '文档会话' });
    await session.getByRole('button', { exact: true, name: 'showcase.md' }).click();
    await window
      .getByRole('complementary', { name: '内容目录' })
      .getByRole('button', { name: '本地资源' })
      .click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect
      .poll(() =>
        finishedDocument
          .getByRole('heading', { name: '本地资源' })
          .evaluate((heading) => Math.round(heading.getBoundingClientRect().top)),
      )
      .toBeLessThan(40);
    await expect
      .poll(async () => {
        try {
          const persisted = JSON.parse(await readFile(sessionFilePath, 'utf8')) as {
            activeDocumentPath?: string;
            openDocuments: Array<{
              path: string;
              readingPosition: { headingId?: string; relativeProgress: number };
            }>;
          };
          const showcase = persisted.openDocuments.find(
            (document) => document.path === showcaseDocumentPath,
          );
          return {
            activeDocumentPath: persisted.activeDocumentPath,
            headingId: showcase?.readingPosition.headingId,
            paths: persisted.openDocuments.map(({ path }) => path),
            progressed: (showcase?.readingPosition.relativeProgress ?? 0) > 0,
          };
        } catch {
          return undefined;
        }
      })
      .toMatchObject({
        activeDocumentPath: showcaseDocumentPath,
        paths: [sourceDocumentPath, showcaseDocumentPath],
        progressed: true,
      });

    await electronApp.close();
    electronApp = await launchDesktop(sourceDocumentPath, launchOptions);
    window = await electronApp.firstWindow();
    const restoredSession = window.getByRole('complementary', { name: '文档会话' });
    await expect(
      restoredSession.getByRole('button', { exact: true, name: 'showcase.md' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      restoredSession.getByRole('button', { name: /^(basic|showcase)\.md$/ }),
    ).toHaveText(['basic.md', 'showcase.md']);
    const restoredDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect
      .poll(() => restoredDocument.locator('body').evaluate(() => Math.round(globalThis.scrollY)))
      .toBeGreaterThan(100);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('restores available documents while unavailable items can be retried, located, or removed', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-recovery-'));
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  const retryPath = join(temporaryDirectory, 'retry.md');
  const locatePath = join(temporaryDirectory, 'locate.md');
  const removePath = join(temporaryDirectory, 'remove.md');
  const reference = (path: string) => ({
    lastOpenedAt: Date.now(),
    name: basename(path),
    path,
    readingPosition: { headingOffset: 0, relativeProgress: 0 },
  });
  await writeFile(
    sessionFilePath,
    JSON.stringify({
      activeDocumentPath: locatePath,
      openDocuments: [
        reference(sourceDocumentPath),
        reference(retryPath),
        reference(locatePath),
        reference(removePath),
      ],
      recentDocuments: [],
      version: 1,
    }),
  );
  const electronApp = await launchDesktop(sourceDocumentPath, {
    locateSourcePath: showcaseDocumentPath,
    sessionFilePath,
  });

  try {
    const window = await electronApp.firstWindow();
    const session = window.getByRole('complementary', { name: '文档会话' });
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: 'A finished document' }),
    ).toBeVisible();
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(session.getByText('retry.md', { exact: true })).toBeVisible();
    await expect(session.getByRole('button', { name: '重试 retry.md' })).toBeVisible();
    await expect(session.getByRole('button', { name: '定位 retry.md' })).toBeVisible();
    await expect(session.getByRole('button', { name: '移除 retry.md' })).toBeVisible();

    await writeFile(retryPath, '# Retried document\n\nRecovered.');
    const canonicalRetryPath = await realpath(retryPath);
    await session.getByRole('button', { name: '重试 retry.md' }).click();
    await expect(session.getByRole('button', { exact: true, name: 'retry.md' })).toBeVisible();

    await session.getByRole('button', { name: '定位 locate.md' }).click();
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toBeVisible();

    await session.getByRole('button', { name: '移除 remove.md' }).click();
    await expect(session.getByText('remove.md', { exact: true })).toHaveCount(0);
    await expect
      .poll(async () => {
        const persisted = JSON.parse(await readFile(sessionFilePath, 'utf8')) as {
          openDocuments: Array<{ path: string }>;
        };
        return persisted.openDocuments.map(({ path }) => path);
      })
      .toEqual([sourceDocumentPath, canonicalRetryPath, showcaseDocumentPath]);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('a reader can open a source document from the start view', async () => {
  const electronApp = await launchDesktop(sourceDocumentPath);

  try {
    const window = await electronApp.firstWindow();

    await expect(window.getByRole('heading', { name: '浮现' })).toBeVisible();
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

test('a reader can manage multiple open and recent documents without duplicates', async () => {
  const equivalentSourceDocumentPath = `${resolve(repositoryRoot, 'fixtures')}/../fixtures/basic.md`;
  const electronApp = await launchDesktop([
    sourceDocumentPath,
    equivalentSourceDocumentPath,
    showcaseDocumentPath,
  ]);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const session = window.getByRole('complementary', { name: '文档会话' });
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toBeVisible();
    await expect(
      finishedDocument.getByRole('heading', { level: 1, name: 'A finished document' }),
    ).toBeVisible();

    const openSection = session.getByRole('button', { name: /正在查看/ });
    const recentSection = session.getByRole('button', { name: /最近查看/ });
    await openSection.click();
    await expect(openSection).toHaveAttribute('aria-expanded', 'false');
    await expect(recentSection).toHaveAttribute('aria-expanded', 'true');
    await openSection.click();

    await session.getByRole('button', { exact: true, name: 'basic.md' }).hover();
    await expect(window.getByRole('tooltip')).toContainText(sourceDocumentPath);

    await session.getByRole('button', { exact: true, name: 'showcase.md' }).click();
    await expect(
      finishedDocument.getByRole('heading', { name: '浮现 Fuxian 富文档展示' }),
    ).toBeVisible();

    await window.getByRole('button', { name: '打开其他文档' }).click();
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await session.getByRole('button', { name: '关闭 basic.md' }).click();
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toBeVisible();
    await session.getByRole('button', { exact: true, name: 'basic.md' }).click();
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await session.getByRole('button', { name: '关闭 basic.md' }).click();
    await session.getByRole('button', { name: '关闭 showcase.md' }).click();
    const startView = window.getByRole('main');
    await expect(startView.getByRole('heading', { name: '最近查看' })).toBeVisible();
    await expect(startView.getByRole('button', { name: 'basic.md' })).toBeVisible();
    await expect(startView.getByRole('button', { name: 'showcase.md' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('command-line paths open one document session and deduplicate canonical files', async () => {
  const equivalentSourceDocumentPath = `${resolve(repositoryRoot, 'fixtures')}/../fixtures/basic.md`;
  const electronApp = await launchDesktop(sourceDocumentPath, {
    commandLineSourcePaths: [
      sourceDocumentPath,
      equivalentSourceDocumentPath,
      showcaseDocumentPath,
    ],
  });

  try {
    const window = await electronApp.firstWindow();
    const session = window.getByRole('complementary', { name: '文档会话' });
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  } finally {
    await electronApp.close();
  }
});

test('a second instance forwards Markdown paths to and activates the primary instance', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-single-instance-'));
  const sessionFilePath = join(temporaryDirectory, 'document-session.json');
  const preferencesFilePath = join(temporaryDirectory, 'reader-preferences.json');
  const electronApp = await launchDesktop(sourceDocumentPath, {
    commandLineSourcePaths: [sourceDocumentPath],
    preferencesFilePath,
    sessionFilePath,
  });

  try {
    const window = await electronApp.firstWindow();
    const session = window.getByRole('complementary', { name: '文档会话' });
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toBeVisible();

    const secondary = spawn(
      electronPath,
      [desktopAppPath, showcaseDocumentPath, sourceDocumentPath],
      {
        env: {
          ...process.env,
          FUXIAN_E2E_PREFERENCES_FILE: preferencesFilePath,
          FUXIAN_E2E_SESSION_FILE: sessionFilePath,
          NODE_ENV: 'test',
        },
        stdio: 'ignore',
      },
    );
    await new Promise<void>((resolveExit, rejectExit) => {
      const timeout = setTimeout(() => {
        secondary.kill();
        rejectExit(new Error('The secondary Fuxian instance did not exit.'));
      }, 10_000);
      secondary.once('error', (error) => {
        clearTimeout(timeout);
        rejectExit(error);
      });
      secondary.once('exit', () => {
        clearTimeout(timeout);
        resolveExit();
      });
    });

    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toHaveCount(1);
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('dropping multiple Markdown documents adds them to the document session', async () => {
  const electronApp = await launchDesktop(sourceDocumentPath);

  try {
    const window = await electronApp.firstWindow();
    await window.evaluate(() => {
      const input = document.createElement('input');
      input.id = 'e2e-dropped-documents';
      input.type = 'file';
      input.multiple = true;
      input.hidden = true;
      document.body.append(input);
    });
    await window
      .locator('#e2e-dropped-documents')
      .setInputFiles([sourceDocumentPath, showcaseDocumentPath]);
    const dataTransfer = await window.evaluateHandle(() => {
      const transfer = new DataTransfer();
      const input = document.querySelector<HTMLInputElement>('#e2e-dropped-documents');
      for (const file of input?.files ?? []) {
        transfer.items.add(file);
      }
      return transfer;
    });

    const dropTarget = window.locator('[data-session-root]');
    await dropTarget.dispatchEvent('dragenter', { dataTransfer });
    await expect(window.getByText('松开以打开文档')).toBeVisible();
    await dropTarget.dispatchEvent('drop', { dataTransfer });

    const session = window.getByRole('complementary', { name: '文档会话' });
    await expect(session.getByRole('button', { exact: true, name: 'basic.md' })).toBeVisible();
    await expect(session.getByRole('button', { exact: true, name: 'showcase.md' })).toBeVisible();
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { level: 1, name: 'A finished document' }),
    ).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('the start view initially shows five recent documents and can reveal all', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-recent-'));
  const recentPaths = Array.from({ length: 6 }, (_, index) =>
    join(temporaryDirectory, `recent-${index}.md`),
  );
  await Promise.all(
    recentPaths.map((path, index) =>
      writeFile(path, `# Recent document ${index}\n\nContent ${index}`),
    ),
  );
  const electronApp = await launchDesktop(recentPaths);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const session = window.getByRole('complementary', { name: '文档会话' });

    for (let index = 0; index < recentPaths.length; index += 1) {
      await session.getByRole('button', { name: `关闭 recent-${index}.md` }).click();
    }

    const startRecent = window.getByRole('region', { name: '最近查看' });
    await expect(startRecent.getByRole('button').filter({ hasText: /^recent-/ })).toHaveCount(5);
    await startRecent.getByRole('button', { name: '查看全部' }).click();
    await expect(startRecent.getByRole('button').filter({ hasText: /^recent-/ })).toHaveCount(6);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
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
    const link = finishedDocument.getByRole('link', { name: 'Fuxian website' });
    await expect(link).toHaveCSS('color', 'rgb(63, 75, 85)');
    await link.hover();
    await expect(link).toHaveCSS('color', 'rgb(37, 41, 45)');
    await link.focus();
    await expect(link).toHaveCSS('outline-style', 'solid');
    await link.click();

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
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );
    await expect(
      finishedDocument.locator('[data-render-task-kind="math-inline"] math'),
    ).toBeVisible();
    await expect(
      finishedDocument.locator('[data-render-task-kind="math-display"] math[display="block"]'),
    ).toBeVisible();
    const mermaidTask = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(mermaidTask.locator('.render-task-output svg')).toBeVisible();
    await expect(mermaidTask).toContainText('Markdown 源文档');
    await expect(mermaidTask).toContainText('完成态文档');
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

test('a failed Mermaid task keeps source-aware details and can retry in place', async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-mermaid-error-'));
  const sourcePath = join(temporaryDirectory, 'invalid-mermaid.md');
  await writeFile(
    sourcePath,
    [
      '# Invalid diagram',
      '',
      'Readable prose remains available.',
      '',
      '```mermaid',
      'not a diagram',
      '```',
    ].join('\n'),
  );
  const electronApp = await launchDesktop(sourcePath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(finishedDocument.getByText('Readable prose remains available.')).toBeVisible();
    const task = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(task.getByText('无法呈现图表')).toBeVisible();
    await expect(task.locator('.render-task-error-source')).toContainText('not a diagram');
    await expect(task).toHaveAttribute('data-render-state', 'failed');
    await expect(finishedDocument.locator('html')).toHaveAttribute(
      'data-render-readiness',
      'ready',
    );

    await task.getByRole('button', { name: '重试' }).click();
    await expect(task).toHaveAttribute('data-render-attempt', '2');
    await expect(task.getByText('无法呈现图表')).toBeVisible();
    await expect(task).toHaveAttribute('data-render-state', 'failed');
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});

test('the content outline navigates nested headings and can be collapsed', async () => {
  const electronApp = await launchDesktop(showcaseDocumentPath);

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();

    const outline = window.getByRole('complementary', { name: '内容目录' });
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(outline).toBeVisible();
    await expect(outline.getByRole('button', { name: '稳定标题' })).toHaveCount(2);
    await expect(outline.getByRole('button', { name: 'Footnotes' })).toHaveCount(0);
    await expect(outline.getByRole('button', { exact: true, name: '深层标题' })).toHaveCount(0);

    await outline.getByRole('button', { name: /展开“这是一个.+”下的深层标题/ }).click();
    await expect(outline.getByRole('button', { exact: true, name: '深层标题' })).toBeVisible();

    await outline.getByRole('button', { name: '本地资源' }).click();
    await expect
      .poll(() =>
        finishedDocument
          .getByRole('heading', { name: '本地资源' })
          .evaluate((heading) => Math.round(heading.getBoundingClientRect().top)),
      )
      .toBeLessThan(40);
    await expect(outline.getByRole('button', { name: '本地资源' })).toHaveAttribute(
      'aria-current',
      'location',
    );

    await window.getByRole('button', { name: '折叠内容目录' }).click();
    await expect(outline).toHaveCount(0);
    await expect(window.getByRole('button', { name: '展开内容目录' })).toBeVisible();
  } finally {
    await electronApp.close();
  }
});

test('find highlights matches without changing the finished document selection', async () => {
  const electronApp = await launchDesktop(showcaseDocumentPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(
      finishedDocument.getByRole('heading', { name: '浮现 Fuxian 富文档展示' }),
    ).toBeVisible();

    await finishedDocument.locator('blockquote').click();
    const selectedText = await finishedDocument.locator('blockquote').evaluate((blockquote) => {
      const selection = globalThis.getSelection();
      const range = document.createRange();
      range.selectNodeContents(blockquote);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return selection?.toString();
    });

    await window.keyboard.press('Control+f');
    const findInput = window.getByRole('textbox', { name: '页内查找' });
    await expect(findInput).toBeFocused();
    await findInput.fill('稳定标题');
    await expect(window.locator('[aria-live="polite"]')).toHaveText('1/2');
    await expect
      .poll(() =>
        finishedDocument.locator('body').evaluate(() => ({
          hasCurrent: CSS.highlights.has('fuxian-find-current'),
          hasResults: CSS.highlights.has('fuxian-find-results'),
          selection: globalThis.getSelection()?.toString(),
        })),
      )
      .toEqual({ hasCurrent: true, hasResults: true, selection: selectedText });

    await window.getByRole('button', { name: '下一个匹配项' }).click();
    await expect(window.locator('[aria-live="polite"]')).toHaveText('2/2');

    await findInput.fill('没有这样的内容');
    await expect(window.locator('[aria-live="polite"]')).toHaveText('0/0');
    await expect(window.getByRole('button', { name: '上一个匹配项' })).toBeDisabled();
    await expect(window.getByRole('button', { name: '下一个匹配项' })).toBeDisabled();

    await window.getByRole('button', { name: '关闭查找' }).click();
    await expect(findInput).toHaveCount(0);
    await expect
      .poll(() =>
        finishedDocument.locator('body').evaluate(() => ({
          hasCurrent: CSS.highlights.has('fuxian-find-current'),
          hasResults: CSS.highlights.has('fuxian-find-results'),
        })),
      )
      .toEqual({ hasCurrent: false, hasResults: false });
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
