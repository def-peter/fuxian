import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const electronPath = require('electron') as string;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const desktopAppPath = resolve(repositoryRoot, 'apps/desktop');

const mindmapSource = `%%{init: {"theme":"base","mindmap":{"padding":24,"maxNodeWidth":170},"themeVariables":{"fontFamily":"system-ui, sans-serif","fontSize":"16px","primaryColor":"#173F5F","primaryTextColor":"#FFFFFF","primaryBorderColor":"#173F5F","secondaryColor":"#E7F2F4","secondaryTextColor":"#16323A","secondaryBorderColor":"#2A9D8F","tertiaryColor":"#FFF3DE","tertiaryTextColor":"#4A3522","tertiaryBorderColor":"#E9C46A","lineColor":"#7B8A97","cScale0":"#E7F2F4","cScale1":"#FFF3DE","cScale2":"#FCE9E4","cScale3":"#EEEAF4","cScaleLabel0":"#16323A","cScaleLabel1":"#4A3522","cScaleLabel2":"#512D27","cScaleLabel3":"#352D46"}}}%%
mindmap
  root((客户明早到访))
    信息确认
      10:00 到达
      3 位来宾
      车辆与联系人
    会议准备
      资料提前摆桌
      演示设备联调
      议题与时间边界
    接待动线
      前台迎接
      展厅参观 20 分钟
      会议室落座
    会后跟进
      当天发送纪要
      样品寄送清单
      下次沟通时间`;

test('keeps a Chinese Mermaid mindmap root label inside its circular node', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-e2e-mermaid-mindmap-'));
  const sourcePath = join(directory, 'mindmap.md');
  const outputPath = join(directory, 'mindmap.pdf');
  await writeFile(
    sourcePath,
    ['# Mermaid mindmap', '', '```mermaid', mindmapSource, '```'].join('\n'),
  );
  const electronApp = await electron.launch({
    executablePath: electronPath,
    args: [desktopAppPath],
    env: {
      ...process.env,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
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
    await expect(diagram).toHaveAttribute('data-render-state', 'succeeded', { timeout: 10_000 });

    const root = diagram.locator('.section-root');
    await expect(root.locator('foreignObject')).toContainText('客户明早到访');
    await expect(root.locator('script, iframe, img, input')).toHaveCount(0);
    const visibleSnapshot = await diagram
      .locator('.render-task-output > svg')
      .evaluate((svg) => svg.outerHTML);
    const geometry = await root.evaluate((element) => {
      const text = element.querySelector<SVGGraphicsElement>('foreignObject');
      const shape = element.querySelector<SVGGraphicsElement>(
        'circle, ellipse, path, polygon, rect',
      );
      if (!text || !shape) throw new Error('Mermaid mindmap root geometry is incomplete.');
      const textBox = text.getBoundingClientRect();
      const shapeBox = shape.getBoundingClientRect();
      return {
        shape: {
          bottom: shapeBox.bottom,
          left: shapeBox.left,
          right: shapeBox.right,
          top: shapeBox.top,
        },
        text: {
          bottom: textBox.bottom,
          left: textBox.left,
          right: textBox.right,
          top: textBox.top,
        },
      };
    });

    expect.soft(geometry.text.left).toBeGreaterThanOrEqual(geometry.shape.left);
    expect.soft(geometry.text.right).toBeLessThanOrEqual(geometry.shape.right);
    expect.soft(geometry.text.top).toBeGreaterThanOrEqual(geometry.shape.top);
    expect.soft(geometry.text.bottom).toBeLessThanOrEqual(geometry.shape.bottom);

    await diagram.getByRole('button', { name: '全屏查看图表' }).click();
    const focusDialog = window.getByRole('dialog', { name: '全屏图表' });
    await expect(focusDialog.locator('.section-root foreignObject')).toContainText('客户明早到访');
    expect(
      await focusDialog
        .getByLabel('图表全屏画布')
        .locator(':scope > div > svg')
        .evaluate((svg) => svg.outerHTML),
    ).toBe(visibleSnapshot);
    await focusDialog.getByRole('button', { name: '返回文档' }).click();

    await window.getByRole('radio', { name: '纸张预览' }).click();
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    await expect(paper.locator('.section-root foreignObject')).toContainText('客户明早到访', {
      timeout: 20_000,
    });

    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 30_000 });
    const bytes = await readFile(outputPath);
    const loading = getDocument({ data: new Uint8Array(bytes) });
    const pdf = await loading.promise;
    const text: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text.push(content.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(''));
    }
    await loading.destroy();
    expect(text.join('').normalize('NFKC').replace(/\s+/gu, '')).toContain('客户明早到访');
  } finally {
    await electronApp.close();
    await rm(directory, { force: true, recursive: true });
  }
});
