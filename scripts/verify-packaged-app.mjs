import { extractFile, listPackage } from '@electron/asar';
import { readdir, stat } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const maxInstallerSizeBytes = 180 * 1024 * 1024;

const collectFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

const normalizePath = (path) => path.split(sep).join('/');
const normalizeArchivePath = (path) => path.replaceAll('\\', '/');
const toArchiveEntryPath = (path) => path.slice(1).split('/').join(sep);
const runtimeProvidedModules = new Set([
  'electron',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

export const findExternalRuntimeImports = (source) =>
  [...source.matchAll(/^import\s+(?:(?:[^'"]+?)\s+from\s+)?["']([^"']+)["'];?\s*$/gm)]
    .map((match) => match[1])
    .filter((specifier) => !runtimeProvidedModules.has(specifier));

export const verifyPackagedApp = async (outputDirectory) => {
  const root = resolve(outputDirectory);
  const files = await collectFiles(root);
  const relativeFiles = files.map((path) => normalizePath(relative(root, path)));
  const errors = [];
  const archives = files.filter((path) =>
    normalizePath(path).toLowerCase().endsWith('/resources/app.asar'),
  );

  if (archives.length === 0) errors.push('no packaged app.asar was found');
  if (
    relativeFiles.some((path) =>
      path.toLowerCase().includes('/app.asar.unpacked/node_modules/electron/'),
    )
  ) {
    errors.push('packaged a second Electron runtime under app.asar.unpacked');
  }

  for (const archive of archives) {
    const entries = listPackage(archive).map(normalizeArchivePath);
    if (entries.some((path) => path.startsWith('/node_modules/electron/'))) {
      errors.push(`${relative(root, archive)} contains the Electron development dependency`);
    }

    const requiredEntries = [
      '/apps/desktop/out/main/index.js',
      '/apps/desktop/out/preload/index.cjs',
      '/apps/desktop/out/renderer/index.html',
      '/package.json',
    ];
    for (const entry of requiredEntries) {
      if (!entries.includes(entry)) errors.push(`${relative(root, archive)} is missing ${entry}`);
    }
    if (requiredEntries.some((entry) => !entries.includes(entry))) continue;

    const mainSource = extractFile(
      archive,
      toArchiveEntryPath('/apps/desktop/out/main/index.js'),
    ).toString('utf8');
    const rendererIndex = extractFile(
      archive,
      toArchiveEntryPath('/apps/desktop/out/renderer/index.html'),
    ).toString('utf8');
    const securitySettings = [
      ['context isolation', /contextIsolation:\s*true/],
      ['disabled Node integration', /nodeIntegration:\s*false/],
      ['renderer sandbox', /sandbox:\s*true/],
    ];
    for (const [name, pattern] of securitySettings) {
      if (!pattern.test(mainSource)) errors.push(`${relative(root, archive)} lacks ${name}`);
    }
    const insecureSettings = [
      ['disabled context isolation', /contextIsolation:\s*false/],
      ['enabled Node integration', /nodeIntegration:\s*true/],
      ['disabled renderer sandbox', /sandbox:\s*false/],
    ];
    for (const [name, pattern] of insecureSettings) {
      if (pattern.test(mainSource)) errors.push(`${relative(root, archive)} contains ${name}`);
    }
    if (!mainSource.includes('loadFile(')) {
      errors.push(`${relative(root, archive)} does not load its bundled renderer`);
    }
    if (!mainSource.includes('disableWebInstaller')) {
      errors.push(`${relative(root, archive)} does not contain the software-update runtime`);
    }
    if (/from ["']electron-updater["']|require\(["']electron-updater["']\)/.test(mainSource)) {
      errors.push(`${relative(root, archive)} leaves electron-updater as an external dependency`);
    }
    const externalRuntimeImports = findExternalRuntimeImports(mainSource);
    if (externalRuntimeImports.length > 0) {
      errors.push(
        `${relative(root, archive)} leaves third-party runtime imports unpackaged: ${[
          ...new Set(externalRuntimeImports),
        ].join(', ')}`,
      );
    }
    if (
      !rendererIndex.includes(
        'default-src &#39;self&#39;; script-src &#39;self&#39;; style-src &#39;self&#39; &#39;unsafe-inline&#39;; connect-src &#39;self&#39;',
      )
    ) {
      errors.push(`${relative(root, archive)} does not contain the production CSP`);
    }
    if (
      rendererIndex.includes('localhost') ||
      rendererIndex.includes('connect-src &#39;self&#39; ws:')
    ) {
      errors.push(`${relative(root, archive)} contains development renderer configuration`);
    }
  }

  const installers = files.filter((path) => /(?:\.dmg|-setup\.exe)$/i.test(path));
  for (const installer of installers) {
    const { size } = await stat(installer);
    if (size > maxInstallerSizeBytes) {
      errors.push(
        `${relative(root, installer)} exceeds 180 MiB (${(size / 1024 / 1024).toFixed(1)} MiB)`,
      );
    }
  }

  if (errors.length > 0) throw new Error(errors.join('\n'));
  return { archives: archives.length, installers: installers.length };
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await verifyPackagedApp(process.argv[2] ?? 'release');
  console.log(
    `Verified ${result.archives} packaged application(s) and ${result.installers} installer(s).`,
  );
}
