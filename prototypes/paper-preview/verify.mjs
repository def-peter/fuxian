import { createRequire } from 'node:module';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const rows = process.env.FUXIAN_PROTOTYPE_ROWS ?? '32';
const url = `http://127.0.0.1:4179/?variant=paged&rows=${encodeURIComponent(rows)}`;
const server = spawn(
  resolve(root, 'apps/desktop/node_modules/.bin/vite'),
  ['prototypes/paper-preview', '--host', '127.0.0.1', '--port', '4179'],
  { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
);
const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Prototype server did not start.');
};

const temporaryDirectory = await mkdtemp(resolve(tmpdir(), 'fuxian-paper-prototype-'));
const pdfPath = resolve(temporaryDirectory, 'paper-preview.pdf');
try {
  await waitForServer();
  const electronPath = process.env.FUXIAN_PROTOTYPE_ELECTRON || require('electron');
  const output = await new Promise((resolveOutput, rejectOutput) => {
    const child = spawn(
      electronPath,
      [resolve(root, 'prototypes/paper-preview/electron-main.cjs'), url, pdfPath],
      { cwd: root },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
      rejectOutput(new Error('Prototype verification exceeded 45 seconds.'));
    }, 45_000);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (code === 0) resolveOutput(stdout);
      else rejectOutput(new Error(stderr || stdout || `Electron exited with ${code}.`));
    });
  });
  const marker = output.split('\n').find((line) => line.startsWith('PROTOTYPE_RESULT:'));
  if (!marker) throw new Error(`Prototype did not report a result.\n${output}`);
  const screen = JSON.parse(marker.slice('PROTOTYPE_RESULT:'.length));
  const loading = getDocument({ data: new Uint8Array(await readFile(pdfPath)) });
  const document = await loading.promise;
  const pdfPages = document.numPages;
  const lastPage = await document.getPage(pdfPages);
  const text = await lastPage.getTextContent();
  const lastPageText = text.items.flatMap((item) => ('str' in item ? [item.str] : [])).join(' ');
  await loading.destroy();
  console.log(
    JSON.stringify(
      { ...screen, pdfPages, pdfHasEnding: lastPageText.includes('FUXIAN_PAPER_PREVIEW_END') },
      null,
      2,
    ),
  );
  if (
    screen.flowTotal !== screen.pageElements ||
    screen.flowTotal !== pdfPages ||
    !screen.endingAnchorPresent ||
    !screen.hasEnding ||
    !lastPageText.includes('FUXIAN_PAPER_PREVIEW_END') ||
    screen.selectableText !== '异步内容结算'
  )
    process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await rm(temporaryDirectory, { force: true, recursive: true });
}
