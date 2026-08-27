import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const servers: Server[] = [];

const launchDesktop = (
  sourceDocumentPaths: string[],
  preferencesFilePath: string,
  sessionFilePath: string,
): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesFilePath,
      FUXIAN_E2E_SESSION_FILE: sessionFilePath,
      FUXIAN_E2E_SOURCE_DOCUMENTS: JSON.stringify(sourceDocumentPaths),
      NODE_ENV: 'test',
    },
  });

const preferences = (plantUmlServerUrl = 'https://www.plantuml.com/plantuml') => ({
  appearance: 'light',
  diagram: { optimize: false },
  documentTypography: { bodyFamily: 'serif', bodySize: 17, lineHeight: 1.85 },
  documentWidth: { customWidth: 860, mode: 'adaptive' },
  plantUml: { serverUrl: plantUmlServerUrl },
  version: 1,
});

const slowDiagramSource = (title: string): string =>
  `# ${title}\n\n\`\`\`plantuml\n@startuml\nAlice -> Bob: pending\n@enduml\n\`\`\``;

const startSlowServer = async (): Promise<{
  nextRequest(): Promise<ServerResponse>;
  url: string;
}> => {
  const responses: ServerResponse[] = [];
  const waiters: Array<(response: ServerResponse) => void> = [];
  const server = createServer((_request, response) => {
    const waiter = waiters.shift();
    if (waiter) waiter(response);
    else responses.push(response);
  });
  servers.push(server);
  await new Promise<void>((resolveListening) => server.listen(0, '127.0.0.1', resolveListening));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PlantUML server did not bind.');
  return {
    nextRequest: () =>
      responses.length > 0
        ? Promise.resolve(responses.shift()!)
        : new Promise((resolveResponse) => waiters.push(resolveResponse)),
    url: `http://127.0.0.1:${address.port}/plantuml`,
  };
};

test.afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolveClosed) => {
          server.closeAllConnections();
          server.close(() => resolveClosed());
        }),
    ),
  );
});

test('keeps inactive documents current, cancels stale work, and reopens cached content', async () => {
  test.setTimeout(90_000);
  const slowServer = await startSlowServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-background-'));
  const firstPath = join(directory, 'first.md');
  const secondPath = join(directory, 'second.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  await writeFile(firstPath, '# First baseline\n\nFirst content.');
  await writeFile(secondPath, '# Second baseline\n\nSecond content.');
  await writeFile(preferencesPath, JSON.stringify(preferences(slowServer.url)));
  const electronApp = await launchDesktop([firstPath, secondPath], preferencesPath, sessionPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[title="Finished document"]');
    await expect(finishedDocument.getByRole('heading', { name: 'First baseline' })).toBeVisible();

    await writeFile(secondPath, slowDiagramSource('Second pending revision'));
    const obsoleteResponse = await slowServer.nextRequest();
    let obsoleteRequestClosed = false;
    obsoleteResponse.on('close', () => {
      obsoleteRequestClosed = true;
    });
    await expect(finishedDocument.getByRole('heading', { name: 'First baseline' })).toBeVisible();

    await window.getByRole('button', { name: 'second.md', exact: true }).click();
    await expect(finishedDocument.getByRole('heading', { name: 'Second baseline' })).toBeVisible();
    await expect(window.getByText('正在更新...')).toBeVisible();

    await writeFile(secondPath, '# Second newest revision\n\nNewest complete content.');
    await expect(
      finishedDocument.getByRole('heading', { name: 'Second newest revision' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => obsoleteRequestClosed).toBe(true);

    await writeFile(firstPath, '# First background revision\n\nUpdated while inactive.');
    await expect
      .poll(async () => {
        await window.getByRole('button', { name: 'first.md', exact: true }).click();
        return finishedDocument.getByRole('heading', { name: 'First background revision' }).count();
      })
      .toBe(1);

    await window.getByRole('button', { name: 'second.md', exact: true }).click();
    await window.getByRole('button', { name: '关闭 second.md' }).click();
    await writeFile(secondPath, slowDiagramSource('Second writing again'));
    await window.getByRole('button', { name: 'second.md', exact: true }).click();
    await expect(
      finishedDocument.getByRole('heading', { name: 'Second newest revision' }),
    ).toBeVisible();
    await expect(window.getByText('正在更新...')).toBeVisible();
    const cachedReopenResponse = await slowServer.nextRequest();
    await writeFile(secondPath, '# Second reopened revision\n\nFinished after reopen.');
    await expect(
      finishedDocument.getByRole('heading', { name: 'Second reopened revision' }),
    ).toBeVisible({ timeout: 10_000 });
    cachedReopenResponse.end(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>obsolete cached reopen</text></svg>',
    );
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('follows appended content only near the end and protects text selection', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-follow-'));
  const sourcePath = join(directory, 'append.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  let source = [
    '# Append stream',
    '',
    ...Array.from({ length: 30 }, (_, index) => `Opening paragraph ${index + 1}.`),
    '',
    '## Reading anchor',
    '',
    ...Array.from({ length: 30 }, (_, index) => `Anchor paragraph ${index + 1}.`),
  ].join('\n\n');
  await writeFile(sourcePath, source);
  await writeFile(preferencesPath, JSON.stringify(preferences()));
  const electronApp = await launchDesktop([sourcePath], preferencesPath, sessionPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const document = window.frameLocator('iframe[title="Finished document"]');
    const distanceFromEnd = () =>
      document.locator('html').evaluate((root) => {
        const view = root.ownerDocument.defaultView!;
        return root.scrollHeight - (view.scrollY + view.innerHeight);
      });
    await document
      .locator('html')
      .evaluate((root) => root.ownerDocument.defaultView?.scrollTo(0, root.scrollHeight));
    await window.waitForTimeout(150);

    source += '\n\nAuto-followed tail.';
    await writeFile(sourcePath, source);
    await expect(document.getByText('Auto-followed tail.')).toBeVisible({ timeout: 10_000 });
    await expect.poll(distanceFromEnd).toBeLessThanOrEqual(64);
    await expect(window.getByRole('button', { name: '有新内容' })).toHaveCount(0);

    const anchor = document.getByRole('heading', { name: 'Reading anchor' });
    await anchor.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const anchorTop = await anchor.evaluate((element) => element.getBoundingClientRect().top);
    source += '\n\nManual-follow tail.';
    await writeFile(sourcePath, source);
    await expect(window.getByRole('button', { name: '有新内容' })).toBeVisible({ timeout: 10_000 });
    await expect
      .poll(() =>
        document
          .getByRole('heading', { name: 'Reading anchor' })
          .evaluate((element) => element.getBoundingClientRect().top),
      )
      .toBeCloseTo(anchorTop, 0);
    await window.getByRole('button', { name: '有新内容' }).click();
    await expect.poll(distanceFromEnd).toBeLessThanOrEqual(2);

    await document.getByText('Manual-follow tail.').evaluate((element) => {
      const selection = element.ownerDocument.defaultView?.getSelection();
      const range = element.ownerDocument.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    source += '\n\nSelection-protected tail.';
    await writeFile(sourcePath, source);
    await expect(window.getByRole('button', { name: '有新内容' })).toBeVisible({ timeout: 10_000 });
    await expect(document.getByText('Selection-protected tail.')).toBeVisible();
    await expect(document.locator('[data-change], mark')).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('shows a stable skeleton while an uncached recent document is rendered', async () => {
  test.setTimeout(60_000);
  const slowServer = await startSlowServer();
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-recent-skeleton-'));
  const sourcePath = join(directory, 'uncached.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  await writeFile(sourcePath, slowDiagramSource('Uncached recent revision'));
  await writeFile(preferencesPath, JSON.stringify(preferences(slowServer.url)));
  await writeFile(
    sessionPath,
    JSON.stringify({
      openDocuments: [],
      recentDocuments: [
        {
          lastOpenedAt: Date.now(),
          name: 'uncached.md',
          path: sourcePath,
          readingPosition: { headingOffset: 0, relativeProgress: 0 },
        },
      ],
      version: 1,
    }),
  );
  const electronApp = await launchDesktop([sourcePath], preferencesPath, sessionPath);

  try {
    const window = await electronApp.firstWindow();
    await window
      .getByLabel('文档会话')
      .getByRole('button', { name: 'uncached.md', exact: true })
      .click();
    await expect(window.getByRole('main', { name: '正在准备文档' })).toBeVisible();
    await expect(window.getByText('正在更新...')).toBeVisible();
    const response = await slowServer.nextRequest();
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    response.end('<svg xmlns="http://www.w3.org/2000/svg"><text>Recent ready</text></svg>');
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: 'Uncached recent revision' }),
    ).toBeVisible({ timeout: 10_000 });
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
