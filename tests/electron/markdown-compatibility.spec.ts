import { _electron as electron, expect, test, type Locator } from '@playwright/test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { captureElectronWindow } from './capture-window';

const electronPath = createRequire(import.meta.url)('electron') as string;

test('basic Markdown compatibility in reading, paper and PDF', async () => {
  test.setTimeout(90_000);
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-markdown-compat-'));
  const docs = join(directory, 'docs');
  await mkdir(docs);
  const sourcePath = join(docs, 'compatibility.md');
  const outputPath = test.info().outputPath('compatibility.pdf');
  const image = (color: string) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="40"><rect width="160" height="40" fill="${color}"/></svg>`,
    );
  await writeFile(join(directory, '图 片%20.svg'), image('#00cc88'));
  const requests: Array<{ url?: string; referer?: string }> = [];
  const server = createServer((request, response) => {
    requests.push({ url: request.url, referer: request.headers.referer });
    // Exercise both an extensionless endpoint and HTTP redirects.
    if (request.url === '/redirect') response.writeHead(302, { Location: '/image?id=1' }).end();
    else response.writeHead(200, { 'Content-Type': 'image/svg+xml' }).end(image('#cc0088'));
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing image server address');
  await writeFile(
    sourcePath,
    [
      '# Markdown compatibility',
      '| Left | Center | Right |\n| :--- | :---: | ---: |\n| Alpha | Beta | Gamma |',
      '<mark>Highlighted text</mark> and <u>underlined text</u>.',
      '<span style="color:#c0392b;background-color:#fff0c8">Author colors</span>',
      '<reader@example.com>',
      '![Parent image](../图%20片%2520.svg)',
      `![Remote image](http://127.0.0.1:${address.port}/redirect)`,
    ].join('\n\n'),
  );
  const app = await electron.launch({
    executablePath: electronPath,
    args: [resolve('apps/desktop')],
    env: {
      ...process.env,
      NODE_ENV: 'test',
      FUXIAN_E2E_SESSION_FILE: join(directory, 'session.json'),
      FUXIAN_E2E_PREFERENCES_FILE: join(directory, 'preferences.json'),
      FUXIAN_E2E_SOURCE_DOCUMENT: sourcePath,
      FUXIAN_E2E_PDF_EXPORT_FILE: outputPath,
    },
  });
  try {
    await app.evaluate(({ shell }) => {
      Reflect.set(globalThis, 'openedMailLinks', []);
      shell.openExternal = async (url) => {
        (Reflect.get(globalThis, 'openedMailLinks') as string[]).push(url);
      };
    });
    const window = await app.firstWindow();
    await window.getByRole('button', { name: '打开 Markdown', exact: true }).click();
    const verify = async (reader: Locator) => {
      await expect(reader.locator('td[align="center"]')).toHaveCSS('text-align', 'center');
      await expect(reader.locator('td[align="right"]')).toHaveCSS('text-align', 'right');
      await expect(reader.locator('mark')).toHaveCSS('background-color', 'rgb(255, 241, 168)');
      await expect(reader.locator('u')).toHaveCSS('text-decoration-line', 'underline');
      const colored = reader.locator('span').filter({ hasText: /^Author colors$/ });
      await expect(colored).toHaveCSS('color', 'rgb(192, 57, 43)');
      await expect(colored).toHaveCSS('background-color', 'rgb(255, 240, 200)');
      const images = reader.locator('img');
      await expect(images).toHaveCount(2);
      await expect
        .poll(() =>
          images.evaluateAll((nodes) =>
            nodes.every((node) => (node as HTMLImageElement).naturalWidth === 160),
          ),
        )
        .toBe(true);
      await reader.getByRole('link', { name: 'reader@example.com' }).click();
    };
    await verify(
      window.frameLocator('iframe[data-finished-document="active"]').locator('.finished-document'),
    );
    await captureElectronWindow(app, window, test.info().outputPath('continuous.png'));
    await window.getByRole('radio', { name: '纸张预览' }).click();
    // Pagination temporarily keeps both the hidden source and generated pages.
    // Inspect only the completed pages mounted in the reader's viewport.
    const paper = window
      .frameLocator('iframe[title="纸张预览"]')
      .locator('.paper-preview-viewport');
    await expect(paper.locator('mark')).toBeVisible({ timeout: 30_000 });
    await verify(paper);
    await captureElectronWindow(app, window, test.info().outputPath('paper.png'));
    await expect
      .poll(() => app.evaluate(() => Reflect.get(globalThis, 'openedMailLinks')))
      .toEqual(['mailto:reader@example.com', 'mailto:reader@example.com']);
    await window.getByRole('button', { name: '导出 PDF', exact: true }).click();
    await expect
      .poll(
        async () => {
          try {
            return (await readFile(outputPath)).subarray(0, 5).toString();
          } catch {
            return '';
          }
        },
        { timeout: 30_000 },
      )
      .toBe('%PDF-');
    const loading = getDocument({ data: new Uint8Array(await readFile(outputPath)) });
    const pdf = await loading.promise;
    try {
      expect(pdf.numPages).toBe(1);
      const page = await pdf.getPage(1);
      const text = await page.getTextContent();
      expect(text.items.map((item) => ('str' in item ? item.str : '')).join(' ')).toContain(
        'Author colors',
      );
      expect(
        (await page.getAnnotations()).some((item) => item.url === 'mailto:reader@example.com'),
      ).toBe(true);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const counts = { parent: 0, remote: 0, highlight: 0, author: 0 };
      for (let index = 0; index < pixels.length; index += 4) {
        const [r, g, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];
        if (r < 10 && g > 195 && g < 215 && b > 125 && b < 145) counts.parent++;
        if (r > 195 && r < 215 && g < 10 && b > 125 && b < 145) counts.remote++;
        if (r > 245 && g > 235 && g < 245 && b > 160 && b < 175) counts.highlight++;
        if (r > 180 && r < 205 && g > 45 && g < 70 && b > 30 && b < 55) counts.author++;
      }
      expect(counts.parent).toBeGreaterThan(500);
      expect(counts.remote).toBeGreaterThan(500);
      expect(counts.highlight).toBeGreaterThan(100);
      expect(counts.author).toBeGreaterThan(20);
      await writeFile(test.info().outputPath('pdf.png'), canvas.toBuffer('image/png'));
    } finally {
      await loading.destroy();
    }
    expect(requests.some((request) => request.url === '/image?id=1')).toBe(true);
    expect(requests.every((request) => !request.referer)).toBe(true);
  } finally {
    await app.close();
    server.closeAllConnections();
    await new Promise<void>((done) => server.close(() => done()));
    await rm(directory, { recursive: true, force: true });
  }
});
