import { execFile } from 'node:child_process';
import { chmod, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, '..');

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  const source = join(repositoryRoot, 'apps/desktop/native/macos-default-app.m');
  const destination = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
    'Contents',
    'Resources',
    'fuxian-default-app-helper',
  );
  await mkdir(dirname(destination), { recursive: true });
  await executeFile('xcrun', [
    'clang',
    '-fobjc-arc',
    '-fblocks',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-mmacosx-version-min=12.0',
    '-arch',
    'x86_64',
    '-arch',
    'arm64',
    source,
    '-framework',
    'AppKit',
    '-framework',
    'Foundation',
    '-o',
    destination,
  ]);
  await chmod(destination, 0o755);
}
