import { _electron as electron } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');
const require = createRequire(resolve(desktopAppPath, 'package.json'));
const electronPath = require('electron');
const imageDirectory = resolve(repositoryRoot, 'apps/website/public/images');
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'fuxian-website-paper-'));

const section = (showcase, heading) => {
  const start = showcase.indexOf(heading);
  const end = showcase.indexOf('\n---\n', start);
  if (start < 0 || end < 0) throw new Error(`Unable to locate showcase section: ${heading}`);
  return showcase.slice(start, end).trim();
};

const showcaseSources = {
  en: await readFile(resolve(repositoryRoot, 'examples/visualization-showcase-en.md'), 'utf8'),
  zh: await readFile(resolve(repositoryRoot, 'examples/visualization-showcase.md'), 'utf8'),
};
const documents = Object.entries(showcaseSources).flatMap(([language, showcase]) => {
  const suffix = language === 'zh' ? '' : '-en';
  const headings =
    language === 'zh'
      ? {
          diagram: '## 客户明早到访，今天要准备什么',
          visualization: '## 六张图，看清这个月的生意',
        }
      : {
          diagram: '## A client arrives tomorrow. What needs to be ready?',
          visualization: '## Six charts, one clear view of the month',
        };

  return [
    {
      kind: 'vega-lite',
      locale: language === 'zh' ? 'zh-CN' : 'en-US',
      name: `paper-visualization${suffix}`,
      source: section(showcase, headings.visualization).replace(/^## /u, '# '),
    },
    {
      kind: 'mermaid',
      locale: language === 'zh' ? 'zh-CN' : 'en-US',
      name: `paper-diagram${suffix}`,
      source: section(showcase, headings.diagram).replace(/^## /u, '# '),
    },
  ];
});

try {
  for (const document of documents) {
    const sourcePath = join(temporaryDirectory, `${document.name}.md`);
    await writeFile(sourcePath, `${document.source}\n`);
    const app = await electron.launch({
      executablePath: electronPath,
      args: [desktopAppPath],
      env: {
        ...process.env,
        FUXIAN_E2E_PREFERENCES_FILE: join(temporaryDirectory, `${document.name}-preferences.json`),
        FUXIAN_E2E_SESSION_FILE: join(temporaryDirectory, `${document.name}-session.json`),
        FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
        FUXIAN_E2E_SYSTEM_LOCALE: document.locale,
        NODE_ENV: 'test',
      },
    });

    try {
      const window = await app.firstWindow();
      await window.setViewportSize({ width: 1600, height: 1000 });
      await window
        .getByRole('button', {
          name: document.locale === 'zh-CN' ? '打开 Markdown' : 'Open Markdown',
        })
        .click();

      const renderedDocument = window.frameLocator('iframe[data-finished-document="active"]');
      await renderedDocument
        .locator(`[data-render-task-kind="${document.kind}"][data-render-state="succeeded"]`)
        .waitFor({ state: 'visible', timeout: 30_000 });

      await window
        .getByRole('radio', { name: document.locale === 'zh-CN' ? '纸张预览' : 'Paper preview' })
        .click();
      const paper = window.frameLocator(
        `iframe[title="${document.locale === 'zh-CN' ? '纸张预览' : 'Paper preview'}"]`,
      );
      const paperPage = paper
        .locator(`[data-render-task-kind="${document.kind}"]`)
        .first()
        .locator(
          'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " pagedjs_page ")]',
        );
      await paperPage.waitFor({ state: 'visible', timeout: 30_000 });
      await paperPage.screenshot({
        animations: 'disabled',
        path: join(imageDirectory, `${document.name}.png`),
      });
    } finally {
      await app.close();
    }
  }
} finally {
  await rm(temporaryDirectory, { force: true, recursive: true });
}
