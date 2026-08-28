import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
type WidthMode = 'a4' | 'adaptive' | 'custom';

const createPreferences = (serverUrl: string, mode: WidthMode) => ({
  appearance: 'light',
  diagram: { optimize: false },
  documentTypography: { bodyFamily: 'serif', bodySize: 17, lineHeight: 1.85 },
  documentWidth: { customWidth: 940, mode },
  plantUml: { serverUrl },
  version: 1,
});

const launchDesktop = (directory: string, mode: WidthMode): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, `${mode}-preferences.json`),
      FUXIAN_E2E_SESSION_FILE: join(directory, `${mode}-session.json`),
      FUXIAN_E2E_SOURCE_DOCUMENT: join(directory, 'aspect-ratios.md'),
      NODE_ENV: 'test',
    },
  });

test('PlantUML diagrams preserve wide and tall viewBox ratios in every document width mode', async () => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-plantuml-aspect-'));
  let requestIndex = 0;
  const server: Server = createServer((_request, response) => {
    const svg =
      requestIndex++ % 2 === 0
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" style="width:1200px;height:600px"><rect width="1200" height="300" fill="white"/><text x="20" y="40">Wide diagram</text></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="960" viewBox="0 0 240 960"><rect width="240" height="960" fill="white"/><text x="20" y="40">Tall diagram</text></svg>';
    response.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    response.end(svg);
  });
  await new Promise<void>((resolveListening) => server.listen(0, '127.0.0.1', resolveListening));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('PlantUML server did not bind.');
  const serverUrl = `http://127.0.0.1:${address.port}/plantuml`;
  await writeFile(
    join(directory, 'aspect-ratios.md'),
    [
      '# PlantUML aspect ratios',
      '',
      '```plantuml',
      '@startuml',
      'Alice -> Bob: wide',
      '@enduml',
      '```',
      '',
      '```plantuml',
      '@startuml',
      'Alice -> Bob: tall',
      '@enduml',
      '```',
    ].join('\n'),
  );

  try {
    for (const mode of ['adaptive', 'a4', 'custom'] as const) {
      await writeFile(
        join(directory, `${mode}-preferences.json`),
        JSON.stringify(createPreferences(serverUrl, mode)),
      );
      const electronApp = await launchDesktop(directory, mode);
      try {
        const window = await electronApp.firstWindow();
        await window.setViewportSize({ height: 900, width: 1_600 });
        await window.getByRole('button', { name: '打开 Markdown' }).click();
        const diagrams = window
          .frameLocator('iframe[title="Finished document"]')
          .locator('[data-render-task-kind="plantuml"]');
        await expect(diagrams).toHaveCount(2);
        await expect(diagrams.nth(1).locator('.render-task-output > svg')).toBeVisible({
          timeout: 10_000,
        });

        const measurements = await diagrams
          .locator('.render-task-output > svg')
          .evaluateAll((svgs) =>
            svgs.map((svg) => {
              const viewBox = svg.getAttribute('viewBox')?.split(/\s+/u).map(Number);
              const box = svg.getBoundingClientRect();
              if (!viewBox || viewBox.length !== 4 || !viewBox[2] || !viewBox[3]) {
                throw new Error('SVG viewBox is missing.');
              }
              return {
                actualRatio: box.width / box.height,
                expectedRatio: viewBox[2] / viewBox[3],
                overflow: box.right - svg.parentElement!.getBoundingClientRect().right,
                viewportHeight: svg.ownerDocument.defaultView!.innerHeight,
                height: box.height,
              };
            }),
          );

        for (const measurement of measurements) {
          expect.soft(measurement.actualRatio).toBeCloseTo(measurement.expectedRatio, 2);
          expect.soft(measurement.overflow).toBeLessThanOrEqual(1);
          expect.soft(measurement.height).toBeLessThanOrEqual(measurement.viewportHeight);
        }
        await diagrams.first().hover();
        await diagrams.first().getByRole('button', { name: '全屏查看图表' }).click();
        const focusedSvg = window
          .getByRole('group', { name: '图表全屏画布' })
          .locator(':scope > div > svg');
        const focusedRatio = await focusedSvg.evaluate((svg) => {
          const box = svg.getBoundingClientRect();
          return box.width / box.height;
        });
        expect.soft(focusedRatio).toBeCloseTo(4, 2);
      } finally {
        await electronApp.close();
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolveClosed) => server.close(() => resolveClosed()));
    await rm(directory, { force: true, recursive: true });
  }
});
