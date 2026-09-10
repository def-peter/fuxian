import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

test('short display formulas do not force premature page breaks', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-paper-math-'));
  const sourcePath = join(directory, 'math.md');
  const outputPath = join(directory, 'math.pdf');
  const source = process.env.FUXIAN_E2E_MATH_DOCUMENT
    ? await readFile(process.env.FUXIAN_E2E_MATH_DOCUMENT, 'utf8')
    : [
        '# Formula pagination',
        ...Array.from({ length: 24 }, () =>
          [
            'A paragraph before the formulas.',
            '$$',
            String.raw`q = 0.5\,s_{15D} + 0.3\,s_{30D} + 0.1\,s_{60D} + 0.1\,s_{\mathrm{HISTORY}}`,
            '$$',
          ].join('\n\n'),
        ),
        '$$',
        String.raw`\text{单窗口表现} = \frac{\log(1 + \text{商品指标})}{\log(1 + \text{满分基准})}`,
        '$$',
        '**② 四窗口合成**：按约定权重计算综合表现。',
        '$$',
        String.raw`q = 0.5\,s_{15D} + 0.3\,s_{30D} + 0.1\,s_{60D} + 0.1\,s_{\mathrm{HISTORY}}`,
        '$$',
        '**③ 因子得分**：乘以权重。',
        '$$',
        String.raw`\text{因子得分} = q \times z`,
        '$$',
        ...Array.from({ length: 25 }, () => 'A paragraph after the formulas.'),
      ].join('\n\n');
  await writeFile(sourcePath, source);
  const app = await electron.launch({
    executablePath: createRequire(import.meta.url)('electron') as string,
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
    },
  });
  try {
    const window = await app.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown' }).click();
    const reading = window.frameLocator('iframe[data-finished-document="active"]');
    await expect(reading.locator('math[display="block"]').first()).toBeAttached();
    const targetFormulaId = await reading
      .locator('.math-render-task')
      .filter({ hasText: 'HISTORY' })
      .last()
      .getAttribute('data-render-task-id');
    expect(targetFormulaId).toBeTruthy();
    const originalMath = await reading
      .locator('math[display="block"]')
      .evaluateAll((elements) => elements.map((element) => element.outerHTML));
    expect(originalMath.length).toBeGreaterThan(0);
    await window.getByRole('radio', { name: '纸张预览' }).click();
    await expect(window.getByText(/^\d+ 页$/)).toBeVisible({ timeout: 30_000 });
    const paper = window.frameLocator('iframe[title="纸张预览"]');
    const paragraph = paper.locator('p').filter({ hasText: '② 四窗口合成' });
    const samePage = paragraph.locator('xpath=ancestor::*[contains(@class,"pagedjs_page ")]');
    await expect(
      samePage.locator(`[data-render-task-id="${targetFormulaId}"] math`),
    ).toBeAttached();
    await expect(paper.locator('.math-render-task[data-split-to]')).toHaveCount(0);
    expect(
      await paper
        .locator('math[display="block"]')
        .evaluateAll((elements) => elements.map((element) => element.outerHTML)),
    ).toEqual(originalMath);
    const count = await paper.locator('.pagedjs_page').count();
    await window.getByRole('button', { name: '导出 PDF' }).click();
    await expect(window.getByText('PDF 已导出')).toBeVisible({ timeout: 30_000 });
    const loading = getDocument({ data: new Uint8Array(await readFile(outputPath)) });
    try {
      const pdf = await loading.promise;
      expect(pdf.numPages).toBe(count);
      await test.info().attach('math.pdf', { path: outputPath, contentType: 'application/pdf' });
    } finally {
      await loading.destroy();
    }
  } finally {
    await app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
