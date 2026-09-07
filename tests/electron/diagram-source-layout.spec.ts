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

test('English diagram source stays within the source drawer', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-diagram-source-layout-'));
  const sourcePath = join(directory, 'diagram-source-layout.md');
  const longToken = 'primaryBorderColor'.repeat(24);
  await writeFile(
    sourcePath,
    [
      '# English diagram source layout',
      '',
      '## A client arrives tomorrow. What needs to be ready? Diagram source context must fit.',
      '',
      '```mermaid',
      `%%{init: {"theme":"base","themeVariables":{"${longToken}":"#173F5F"}}}%%`,
      'flowchart LR',
      '  A[Confirm details] --> B[Prepare the meeting room]',
      '```',
      '',
      '## Diagram',
      '',
      '```mermaid',
      'flowchart LR',
      '  C[Short context] --> D[No tooltip needed]',
      '```',
    ].join('\n'),
    'utf8',
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_SYSTEM_LOCALE: 'en-US',
      NODE_ENV: 'test',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_440 });
    await window.getByRole('button', { name: 'Open Markdown' }).click();
    const finishedDocument = window.frameLocator('iframe[data-finished-document="active"]');
    const diagrams = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(diagrams).toHaveCount(2);
    await expect(diagrams.nth(0)).toHaveAttribute('data-render-state', 'succeeded', {
      timeout: 10_000,
    });
    await expect(diagrams.nth(1)).toHaveAttribute('data-render-state', 'succeeded', {
      timeout: 10_000,
    });
    await diagrams.nth(0).hover();
    await diagrams.nth(0).getByRole('button', { name: 'View diagram source' }).click();

    const sourceDrawer = window.getByRole('complementary', { name: 'Diagram source' });
    await expect(sourceDrawer).toBeVisible();
    const layout = await sourceDrawer.evaluate((drawer) => {
      const header = drawer.querySelector('header');
      const sourceRegion = drawer.children.item(1);
      const source = drawer.querySelector('pre');
      const footer = drawer.querySelector('footer');
      return {
        drawerWidth: drawer.clientWidth,
        footerWidth: footer?.clientWidth,
        headerWidth: header?.clientWidth,
        overflows: {
          drawer: drawer.scrollWidth - drawer.clientWidth,
          footer: (footer?.scrollWidth ?? 0) - (footer?.clientWidth ?? 0),
          header: (header?.scrollWidth ?? 0) - (header?.clientWidth ?? 0),
          source: (source?.scrollWidth ?? 0) - (source?.clientWidth ?? 0),
          sourceRegion: (sourceRegion?.scrollWidth ?? 0) - (sourceRegion?.clientWidth ?? 0),
        },
        sourceRegionWidth: sourceRegion?.clientWidth,
      };
    });

    expect(layout.drawerWidth).toBeGreaterThan(300);
    expect(layout.footerWidth).toBe(layout.drawerWidth);
    expect(layout.headerWidth).toBe(layout.drawerWidth);
    expect(layout.sourceRegionWidth).toBe(layout.drawerWidth);
    expect(layout.overflows).toEqual({
      drawer: 0,
      footer: 0,
      header: 0,
      source: 0,
      sourceRegion: 0,
    });

    const context = sourceDrawer.locator('header p');
    await expect
      .poll(() => context.evaluate((element) => element.scrollWidth > element.clientWidth))
      .toBe(true);
    const longContext = (await context.textContent()) ?? '';
    await context.hover();
    await expect(window.getByRole('tooltip')).toHaveText(longContext);

    await diagrams.nth(1).hover();
    await diagrams.nth(1).getByRole('button', { name: 'View diagram source' }).click();
    await expect(sourceDrawer.getByText('Diagram · Diagram 2')).toBeVisible();
    await expect
      .poll(() => context.evaluate((element) => element.scrollWidth <= element.clientWidth))
      .toBe(true);
    await context.hover();
    await expect(window.getByRole('tooltip')).toHaveCount(0);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
