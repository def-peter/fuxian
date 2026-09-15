import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
await build({ root });
const template = await readFile(resolve(root, 'dist/index.html'), 'utf8');
if (!template.includes('<div id="root"></div>') || !template.includes('<title>')) {
  throw new Error('Prerender template must contain the root element and a title.');
}
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
try {
  const { render, sitemap } = await server.ssrLoadModule('/src/entry-server.tsx');
  const routes = [
    ['', 'zh', 'home'],
    ['zh', 'zh', 'home'],
    ['en', 'en', 'home'],
    ['zh/features', 'zh', 'features'],
    ['en/features', 'en', 'features'],
  ];
  for (const [path, language, page] of routes) {
    const rendered = render(language, page);
    const html = template
      .replace('lang="zh-CN"', `lang="${rendered.language}"`)
      .replace(/<title>.*?<\/title>/s, () => rendered.head)
      .replace('<div id="root"></div>', () => `<div id="root">${rendered.html}</div>`);
    const directory = resolve(root, 'dist', path);
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'index.html'), html);
  }
  await writeFile(resolve(root, 'dist/sitemap.xml'), sitemap());
  await writeFile(resolve(root, 'dist/.nojekyll'), '');
  console.log(`Prerendered ${routes.length} pages and sitemap.xml`);
} finally {
  await server.close();
}
