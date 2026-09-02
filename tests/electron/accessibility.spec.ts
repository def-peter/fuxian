import axe, { type AxeResults } from 'axe-core';
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultReaderPreferences } from '../../packages/shared-types/src/index';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

const launchDesktop = (
  sourcePath: string,
  preferencesPath: string,
  sessionPath: string,
  pdfPath: string,
): Promise<ElectronApplication> =>
  electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PDF_EXPORT_FILE: pdfPath,
      FUXIAN_E2E_PREFERENCES_FILE: preferencesPath,
      FUXIAN_E2E_SESSION_FILE: sessionPath,
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      NODE_ENV: 'test',
    },
  });

const expectNoHighImpactViolations = async (page: Page): Promise<void> => {
  await page.evaluate(axe.source);
  const results = await page.evaluate<Promise<AxeResults>>(async () => {
    const axeApi = (window as typeof window & { axe: typeof axe }).axe;
    return axeApi.run(
      { exclude: [['iframe']] },
      { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } },
    );
  });
  expectNoHighImpactResults(results);
};

const expectNoHighImpactResults = (results: AxeResults): void => {
  const violations = results.violations.filter(
    (violation) => violation.impact === 'critical' || violation.impact === 'serious',
  );
  expect(
    violations.map(({ help, id, impact, nodes }) => ({
      help,
      id,
      impact,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
};

const getSettingsWindow = async (electronApp: ElectronApplication): Promise<Page> => {
  await expect.poll(() => electronApp.windows().length).toBe(2);
  const settingsWindow = electronApp
    .windows()
    .find((page) => new URL(page.url()).searchParams.get('view') === 'settings');
  if (!settingsWindow) throw new Error('Settings window did not open.');
  await settingsWindow.waitForLoadState('domcontentloaded');
  return settingsWindow;
};

const waitForLayerReady = async (layer: Locator): Promise<void> => {
  await expect
    .poll(() =>
      layer.evaluate((element) =>
        element.getAnimations().every((animation) => animation.playState === 'finished'),
      ),
    )
    .toBe(true);
};

test('supports the core reader workflow with keyboard and assistive semantics', async () => {
  test.setTimeout(90_000);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-accessibility-'));
  const sourcePath = join(temporaryDirectory, 'keyboard-reader.md');
  const preferencesPath = join(temporaryDirectory, 'reader-preferences.json');
  const sessionPath = join(temporaryDirectory, 'document-session.json');
  const pdfPath = join(temporaryDirectory, 'keyboard-reader.pdf');
  await writeFile(
    sourcePath,
    [
      '# Keyboard reader',
      '',
      'Searchable finished-document content.',
      '',
      '## Diagram',
      '',
      '```mermaid',
      'flowchart LR',
      '  A[Keyboard] --> B[Finished document]',
      '```',
      '',
      '## Export',
      '',
      'Tagged PDF content.',
    ].join('\n'),
    'utf8',
  );
  await writeFile(preferencesPath, JSON.stringify(createDefaultReaderPreferences()), 'utf8');

  const electronApp = await launchDesktop(sourcePath, preferencesPath, sessionPath, pdfPath);

  try {
    const readerWindow = await electronApp.firstWindow();
    await readerWindow.setViewportSize({ height: 768, width: 1_024 });

    const openDocument = readerWindow.getByRole('button', { name: '打开文档' });
    await openDocument.focus();
    await readerWindow.keyboard.press('Tab');
    await expect(readerWindow.getByRole('button', { name: '收起文档会话' })).toBeFocused();
    await readerWindow.keyboard.press('Shift+Tab');
    await expect(openDocument).toBeFocused();
    await readerWindow.keyboard.press('Enter');

    const frame = readerWindow.locator('iframe[title="Finished document"]');
    const finishedDocument = readerWindow.frameLocator('iframe[title="Finished document"]');
    await expect(finishedDocument.getByRole('heading', { name: 'Keyboard reader' })).toBeVisible();
    await expectNoHighImpactViolations(readerWindow);

    const outlineTrigger = readerWindow.getByRole('button', { name: '打开内容目录' });
    await outlineTrigger.focus();
    await readerWindow.keyboard.press('Enter');
    const outlineDialog = readerWindow.getByRole('dialog');
    await expect(outlineDialog.getByRole('complementary', { name: '内容目录' })).toBeVisible();
    await expect(outlineDialog).toBeFocused();
    await waitForLayerReady(outlineDialog);
    await outlineDialog.press('Escape');
    await expect(outlineDialog).toHaveCount(0);
    await expect(outlineTrigger).toBeFocused();

    await frame.focus();
    await readerWindow.keyboard.press('Meta+f');
    const findInput = readerWindow.getByRole('textbox', { name: '页内查找' });
    await expect(findInput).toBeFocused();
    await findInput.fill('content');
    await readerWindow.keyboard.press('Enter');
    await expect(readerWindow.getByRole('search', { name: '页内查找' })).toContainText('2/2');
    await findInput.press('Escape');
    await expect(readerWindow.getByRole('search', { name: '页内查找' })).toHaveCount(0);
    await expect(frame).toBeFocused();

    const diagramTask = finishedDocument.locator('[data-render-task-kind="mermaid"]');
    await expect(diagramTask).toHaveAttribute('data-render-state', 'succeeded');
    const sourceAction = diagramTask.getByRole('button', { name: '查看图表源码' });
    await sourceAction.focus();
    await sourceAction.press('Enter');
    const sourceDialog = readerWindow.getByRole('dialog');
    await expect(sourceDialog.getByRole('complementary', { name: '图表源码' })).toBeVisible();
    await expect(sourceDialog.getByLabel('Mermaid 图表源码')).toBeVisible();
    await waitForLayerReady(sourceDialog);
    await sourceDialog.press('Escape');
    await expect(sourceDialog).toHaveCount(0);
    await expect(sourceAction).toBeFocused();

    const focusAction = diagramTask.getByRole('button', { name: '全屏查看图表' });
    await focusAction.focus();
    await focusAction.press('Enter');
    const focusDialog = readerWindow.getByRole('dialog', { name: '全屏图表' });
    const canvas = focusDialog.getByRole('group', { name: '图表全屏画布' });
    await canvas.focus();
    await canvas.press('+');
    await expect(focusDialog.getByText('120%')).toBeVisible();
    const transformBeforePan = await canvas.locator(':scope > div').getAttribute('style');
    await canvas.press('ArrowRight');
    await expect
      .poll(() => canvas.locator(':scope > div').getAttribute('style'))
      .not.toBe(transformBeforePan);
    await waitForLayerReady(focusDialog);
    await canvas.press('Escape');
    await expect(focusDialog).toHaveCount(0);
    await expect(focusAction).toBeFocused();

    const settingsButton = readerWindow.getByRole('button', { name: '设置' });
    await settingsButton.focus();
    await settingsButton.press('Enter');
    const settingsWindow = await getSettingsWindow(electronApp);
    await expect(settingsWindow.getByRole('heading', { name: '设置' })).toBeVisible();
    await expectNoHighImpactViolations(settingsWindow);

    await readerWindow.emulateMedia({ forcedColors: 'active' });
    const activeDocument = readerWindow.getByRole('button', {
      exact: true,
      name: 'keyboard-reader.md',
    });
    await expect(activeDocument).toHaveAttribute('aria-current', 'page');
    await expect(activeDocument).toHaveCSS('outline-style', 'solid');
    await outlineTrigger.focus();
    await expect(outlineTrigger).toHaveCSS('outline-style', 'solid');

    const exportButton = readerWindow.getByRole('button', { name: '导出 PDF' });
    await exportButton.focus();
    await exportButton.press('Enter');
    await expect
      .poll(async () =>
        access(pdfPath).then(
          () => true,
          () => false,
        ),
      )
      .toBe(true);
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
