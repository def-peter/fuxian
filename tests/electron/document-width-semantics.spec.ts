import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
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

const preferences = (mode: WidthMode) => ({
  appearance: 'light',
  diagram: { optimize: false },
  documentTypography: { bodyFamily: 'serif', bodySize: 17, lineHeight: 1.85 },
  documentWidth: { customWidth: 860, mode },
  plantUml: { serverUrl: 'http://127.0.0.1:1/plantuml' },
  version: 1,
});

const launchDesktop = async (directory: string, mode: WidthMode): Promise<ElectronApplication> => {
  const sourcePath = join(directory, `${mode}.md`);
  const preferencesPath = join(directory, `${mode}-preferences.json`);
  await writeFile(sourcePath, `# ${mode} width\n\nFinished document content.`);
  await writeFile(preferencesPath, JSON.stringify(preferences(mode)));
  return electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
      FUXIAN_E2E_SESSION_FILE: join(directory, `${mode}-session.json`),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });
};

test('document width modes size the whole white paper while adaptive content stays wide', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-document-width-'));
  let electronApp: ElectronApplication | undefined;

  try {
    electronApp = await launchDesktop(directory, 'adaptive');
    let window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_600 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const adaptivePaper = window.locator('iframe[title="Finished document"]');
    await expect(adaptivePaper).toBeVisible();
    const adaptivePaperBox = await adaptivePaper.boundingBox();
    const adaptiveContent = await window
      .frameLocator('iframe[title="Finished document"]')
      .locator('.finished-document')
      .evaluate((element) => {
        const style = getComputedStyle(element);
        const width = element.getBoundingClientRect().width;
        const padding =
          Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
        return { contentRatio: (width - padding) / width, padding };
      });
    await electronApp.close();
    electronApp = await launchDesktop(directory, 'a4');
    window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_600 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const a4Paper = window.locator('iframe[title="Finished document"]');
    await expect(a4Paper).toBeVisible();
    const a4PaperBox = await a4Paper.boundingBox();

    await electronApp.close();
    electronApp = await launchDesktop(directory, 'custom');
    window = await electronApp.firstWindow();
    await window.setViewportSize({ height: 900, width: 1_600 });
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const customPaper = window.locator('iframe[title="Finished document"]');
    await expect(customPaper).toBeVisible();
    const customPaperBox = await customPaper.boundingBox();

    expect(adaptivePaperBox).not.toBeNull();
    expect(a4PaperBox).not.toBeNull();
    expect(customPaperBox).not.toBeNull();
    expect(a4PaperBox?.width).toBeCloseTo(794, 0);
    expect(customPaperBox?.width).toBeCloseTo(860, 0);
    expect(a4PaperBox?.width ?? 0).toBeLessThan((adaptivePaperBox?.width ?? 0) - 200);
    expect(adaptiveContent.padding).toBeLessThanOrEqual(64);
    expect(adaptiveContent.contentRatio).toBeGreaterThanOrEqual(0.94);
  } finally {
    await electronApp?.close().catch(() => undefined);
    await rm(directory, { force: true, recursive: true });
  }
});
