import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const sourceDocumentPath = resolve(repositoryRoot, 'fixtures/code-highlighting.md');

interface LaunchOptions {
  preferencesFilePath: string;
  sessionFilePath: string;
}

const launchDesktop = ({
  preferencesFilePath,
  sessionFilePath,
}: LaunchOptions): Promise<ElectronApplication> =>
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

const getSettingsWindow = async (electronApp: ElectronApplication): Promise<Page> => {
  await expect.poll(() => electronApp.windows().length).toBe(2);
  const settingsWindow = electronApp
    .windows()
    .find((window) => new URL(window.url()).searchParams.get('view') === 'settings');
  if (!settingsWindow) {
    throw new Error('Settings window did not open.');
  }
  await settingsWindow.waitForLoadState('domcontentloaded');
  return settingsWindow;
};

const readDocumentVariables = (page: Page, title: string) =>
  page
    .frameLocator(`iframe[title="${title}"]`)
    .locator('html')
    .evaluate((root) => {
      const bodyParagraph = root.querySelector('p');
      return {
        appearance: root.dataset.appearance,
        bodyFont: root.style.getPropertyValue('--document-body-font'),
        bodySize: root.style.getPropertyValue('--document-body-size'),
        codeBackground: getComputedStyle(root).getPropertyValue('--code-background').trim(),
        codeTheme: root.dataset.codeTheme,
        computedBodyFont: bodyParagraph ? getComputedStyle(bodyParagraph).fontFamily : undefined,
        lineHeight: root.style.getPropertyValue('--document-line-height'),
        width: root.style.getPropertyValue('--document-width'),
      };
    });

test('preferences synchronize live, persist at their limits, and restore after restart', async () => {
  test.setTimeout(60_000);
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-preferences-'));
  const launchOptions = {
    preferencesFilePath: join(temporaryDirectory, 'reader-preferences.json'),
    sessionFilePath: join(temporaryDirectory, 'document-session.json'),
  };
  let electronApp = await launchDesktop(launchOptions);

  try {
    let readerWindow = await electronApp.firstWindow();
    await readerWindow.getByRole('button', { name: '打开 Markdown' }).click();
    await expect(
      readerWindow
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: '代码高亮主题' }),
    ).toBeVisible();
    const defaultTypography = {
      bodyFont: 'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      bodySize: '15px',
      codeBackground: '#f7faf8',
      codeTheme: 'fuxian-light',
      computedBodyFont:
        'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      lineHeight: '1.85',
    };
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toMatchObject(defaultTypography);
    await readerWindow.getByRole('button', { name: '文档宽度' }).click();
    await readerWindow.getByRole('radio', { name: 'A4' }).click();
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toMatchObject({ width: '794px' });

    await readerWindow.getByRole('button', { name: '设置' }).click();
    let settingsWindow = await getSettingsWindow(electronApp);
    await readerWindow.getByRole('button', { name: '设置' }).click();
    await expect.poll(() => electronApp.windows().length).toBe(2);
    await expect(settingsWindow.getByRole('button', { name: '图表', exact: true })).toHaveCount(0);
    await expect(settingsWindow.getByRole('switch', { name: '优化图表' })).toHaveCount(0);

    await settingsWindow.getByRole('button', { name: '文档', exact: true }).click();
    await expect(settingsWindow.getByRole('radio', { name: '无衬线' })).toHaveAttribute(
      'data-state',
      'on',
    );
    await expect(settingsWindow.getByRole('slider', { name: '正文字号' })).toHaveAttribute(
      'aria-valuenow',
      '15',
    );
    await expect(settingsWindow.getByRole('radio', { name: '浮现浅色' })).toHaveAttribute(
      'data-state',
      'on',
    );
    await expect
      .poll(() => readDocumentVariables(settingsWindow, '完成文档预览'))
      .toMatchObject(defaultTypography);

    await settingsWindow.getByRole('button', { name: '外观', exact: true }).click();
    await settingsWindow.getByRole('radio', { name: '浅色' }).click();
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toMatchObject({ appearance: 'light' });

    await settingsWindow.getByRole('button', { name: '文档', exact: true }).click();
    await settingsWindow.getByRole('radio', { name: 'GitHub 深色' }).click();
    await expect(
      settingsWindow.frameLocator('iframe[title="完成文档预览"]').locator('.code-block'),
    ).toBeInViewport();
    const darkCodeOnLightDocument = {
      appearance: 'light',
      codeBackground: '#0d1117',
      codeTheme: 'github-dark',
    };
    await expect
      .poll(() => readDocumentVariables(settingsWindow, '完成文档预览'))
      .toMatchObject(darkCodeOnLightDocument);
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toMatchObject(darkCodeOnLightDocument);

    await settingsWindow.getByRole('button', { name: '外观', exact: true }).click();
    await settingsWindow.getByRole('radio', { name: '深色' }).click();
    await expect(settingsWindow.locator('html')).toHaveClass(/dark/);
    await expect(readerWindow.locator('html')).toHaveClass(/dark/);

    await settingsWindow.getByRole('button', { name: '文档', exact: true }).click();
    await settingsWindow.getByRole('radio', { name: '自定义' }).click();
    await settingsWindow.getByRole('slider', { name: '自定义文档宽度' }).press('End');
    await settingsWindow.getByRole('radio', { name: '无衬线' }).click();
    await settingsWindow.getByRole('slider', { name: '正文字号' }).press('End');
    await settingsWindow.getByRole('slider', { name: '正文行高' }).press('Home');

    const expectedVariables = {
      appearance: 'dark',
      bodyFont: 'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      bodySize: '22px',
      codeBackground: '#0d1117',
      codeTheme: 'github-dark',
      computedBodyFont:
        'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      lineHeight: '1.5',
      width: '1200px',
    };
    await expect
      .poll(() => readDocumentVariables(settingsWindow, '完成文档预览'))
      .toEqual(expectedVariables);
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toEqual(expectedVariables);
    await readerWindow.getByRole('radio', { name: '纸张预览' }).click();
    await expect(readerWindow.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => readDocumentVariables(readerWindow, '纸张预览'))
      .toMatchObject({ codeBackground: '#0d1117', codeTheme: 'github-dark' });
    await readerWindow.getByRole('radio', { name: '无界阅读' }).click();
    await expect(
      readerWindow
        .frameLocator('iframe[title="Finished document"]')
        .getByRole('heading', { name: '代码高亮主题' }),
    ).toBeVisible();
    await settingsWindow.close();
    await expect.poll(() => electronApp.windows().length).toBe(1);
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toEqual(expectedVariables);

    await expect
      .poll(async () => JSON.parse(await readFile(launchOptions.preferencesFilePath, 'utf8')))
      .toEqual({
        appearance: 'dark',
        codeHighlight: { theme: 'github-dark' },
        documentTypography: { bodyFamily: 'sans-serif', bodySize: 22, lineHeight: 1.5 },
        documentWidth: { customWidth: 1200, mode: 'custom' },
        plantUml: { serverUrl: 'https://www.plantuml.com/plantuml' },
        shell: { contentOutlineExpanded: true, documentSessionExpanded: true },
        version: 1,
      });

    await electronApp.close();
    electronApp = await launchDesktop(launchOptions);
    readerWindow = await electronApp.firstWindow();
    await expect(readerWindow.locator('html')).toHaveClass(/dark/);
    await expect
      .poll(() => readDocumentVariables(readerWindow, 'Finished document'))
      .toEqual(expectedVariables);

    await readerWindow.getByRole('button', { name: '设置' }).click();
    settingsWindow = await getSettingsWindow(electronApp);
    await settingsWindow.getByRole('button', { name: '文档', exact: true }).click();
    await expect(settingsWindow.getByRole('radio', { name: '自定义' })).toHaveAttribute(
      'data-state',
      'on',
    );
    await expect(settingsWindow.getByRole('slider', { name: '正文字号' })).toHaveAttribute(
      'aria-valuenow',
      '22',
    );
    await expect(settingsWindow.getByRole('radio', { name: 'GitHub 深色' })).toHaveAttribute(
      'data-state',
      'on',
    );
  } finally {
    await electronApp.close();
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
});
