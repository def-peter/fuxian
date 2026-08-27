import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { createServer, type ServerResponse, type Server } from 'node:http';
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
  sourceDocumentPath: string,
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
      FUXIAN_E2E_SOURCE_DOCUMENT: sourceDocumentPath,
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

const revisionSource = (title: string, prefixParagraphs: number, tail = ''): string =>
  [
    `# ${title}`,
    '',
    ...Array.from({ length: prefixParagraphs }, (_, index) => `Prefix paragraph ${index + 1}.`),
    '',
    '## Reading anchor',
    '',
    ...Array.from({ length: 20 }, (_, index) => `Anchor paragraph ${index + 1}.`),
    tail,
  ].join('\n\n');

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

test('coalesces writes, keeps the successful document visible, and cancels stale revisions', async () => {
  test.setTimeout(90_000);
  let slowResponse: ServerResponse | undefined;
  let slowRequestStarted: (() => void) | undefined;
  let slowRequestClosed = false;
  const slowRequest = new Promise<void>((resolveStarted) => {
    slowRequestStarted = resolveStarted;
  });
  const server = createServer((_request, response) => {
    slowResponse = response;
    slowRequestStarted?.();
    response.on('close', () => {
      slowRequestClosed = true;
    });
  });
  servers.push(server);
  await new Promise<void>((resolveListening) => server.listen(0, '127.0.0.1', resolveListening));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PlantUML server did not bind.');

  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-external-'));
  const sourcePath = join(directory, 'external.md');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  await writeFile(sourcePath, revisionSource('Initial document', 18));
  await writeFile(
    preferencesPath,
    JSON.stringify(preferences(`http://127.0.0.1:${address.port}/plantuml`)),
  );
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const currentDocument = window.frameLocator('iframe[title="Finished document"]');
    const anchor = currentDocument.getByRole('heading', { name: 'Reading anchor' });
    await anchor.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    const anchorTop = await anchor.evaluate((element) => element.getBoundingClientRect().top);
    await window.waitForTimeout(200);

    await writeFile(sourcePath, '# Intermediate content that must never appear');
    await window.waitForTimeout(30);
    await writeFile(
      sourcePath,
      revisionSource(
        'Slow revision',
        28,
        '```plantuml\n@startuml\nAlice -> Bob: slow\n@enduml\n```',
      ),
    );
    await slowRequest;
    await expect(window.getByText('正在更新...')).toBeVisible();
    await expect(currentDocument.getByRole('heading', { name: 'Initial document' })).toBeVisible();
    await expect(
      currentDocument.getByText('Intermediate content that must never appear'),
    ).toHaveCount(0);

    await writeFile(sourcePath, revisionSource('Newest stable revision', 34));
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: 'Newest stable revision' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(window.getByText(/已更新 ·/)).toBeVisible();
    await expect.poll(() => slowRequestClosed).toBe(true);
    await expect
      .poll(async () =>
        Math.abs(
          (await window
            .frameLocator('iframe[title="Finished document"]')
            .getByRole('heading', { name: 'Reading anchor' })
            .evaluate((element) => element.getBoundingClientRect().top)) - anchorTop,
        ),
      )
      .toBeLessThanOrEqual(1);

    slowResponse?.end(
      '<svg xmlns="http://www.w3.org/2000/svg"><text>obsolete response</text></svg>',
    );
    await expect(
      window.frameLocator('iframe[title="Finished document"]').getByText('obsolete response'),
    ).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});

test('keeps the prior revision on failure, retries, and tracks local resource changes', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-external-resource-'));
  const sourcePath = join(directory, 'external.md');
  const imagePath = join(directory, 'status.svg');
  const preferencesPath = join(directory, 'preferences.json');
  const sessionPath = join(directory, 'session.json');
  const validSource = '# Resource revision\n\n![Status](status.svg)\n\n## Stable content';
  await writeFile(sourcePath, validSource);
  await writeFile(
    imagePath,
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="green"/></svg>',
  );
  await writeFile(preferencesPath, JSON.stringify(preferences()));
  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath);

  try {
    const window = await electronApp.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const visibleFrame = window.locator('iframe[title="Finished document"]');
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: 'Stable content' }),
    ).toBeVisible();
    await window.waitForTimeout(200);

    await writeFile(
      sourcePath,
      '# Broken revision\n\n```mermaid\nthis is not valid mermaid syntax !!!\n```',
    );
    await expect(window.getByText('更新失败', { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: 'Stable content' }),
    ).toBeVisible();
    await window.getByRole('button', { name: '详情' }).click();
    await expect(window.getByText('文档更新失败')).toBeVisible();
    await expect(window.getByText(/mermaid/i)).toBeVisible();

    await writeFile(
      sourcePath,
      '# Recovered revision\n\n![Status](status.svg)\n\n## Stable content',
    );
    await window.getByRole('button', { name: '重试文档更新' }).click();
    await expect(
      window
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: 'Recovered revision' }),
    ).toBeVisible({ timeout: 10_000 });
    const revisionBeforeResourceChange = await visibleFrame.getAttribute('data-frame-revision');
    await window.waitForTimeout(200);

    await writeFile(
      imagePath,
      '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>',
    );
    await expect
      .poll(() => visibleFrame.getAttribute('data-frame-revision'), { timeout: 10_000 })
      .not.toBe(revisionBeforeResourceChange);
    await expect(window.getByText(/已更新 ·/)).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
