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

test('diagram controls stay compact and outside the rendered graphic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-diagram-controls-'));
  const sourcePath = join(directory, 'diagram-controls.md');
  await writeFile(
    sourcePath,
    [
      '# Diagram controls',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[Dense top-left content] --> B[Dense top-right content]',
      '```',
    ].join('\n'),
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
    const diagram = window
      .frameLocator('iframe[data-finished-document="active"]')
      .locator('[data-render-task-kind="mermaid"]');
    await expect(diagram.locator('.render-task-output svg')).toBeVisible({ timeout: 10_000 });
    const geometry = await diagram.evaluate((element) => {
      const toolbar = element.querySelector<HTMLElement>('.diagram-action-toolbar');
      const svg = element.querySelector<SVGElement>('.render-task-output svg');
      const buttons = Array.from(element.querySelectorAll<HTMLElement>('.diagram-action-button'));
      if (!toolbar || !svg || buttons.length !== 2)
        throw new Error('Diagram controls are incomplete.');
      const toolbarBox = toolbar.getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      return {
        buttonSizes: buttons.map((button) => {
          const box = button.getBoundingClientRect();
          return { height: box.height, width: box.width };
        }),
        toolbarBottom: toolbarBox.bottom,
        svgTop: svgBox.top,
      };
    });

    for (const size of geometry.buttonSizes) {
      expect.soft(size.width).toBeLessThanOrEqual(24);
      expect.soft(size.height).toBeLessThanOrEqual(24);
    }
    expect.soft(geometry.toolbarBottom).toBeLessThanOrEqual(geometry.svgTop);
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
