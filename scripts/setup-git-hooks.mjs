import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

const repository = git(['rev-parse', '--show-toplevel']);
if (repository.error || repository.status !== 0 || resolve(repository.stdout.trim()) !== root) {
  console.log('Skipping Git hooks outside the repository checkout.');
  process.exit(0);
}

const existing = git(['config', '--get', 'core.hooksPath']);
if (existing.status === 0) {
  const path = existing.stdout.trim();
  console.log(
    path === '.githooks'
      ? 'Repository Git hooks are already enabled.'
      : `Keeping the existing Git hooks path: ${path}`,
  );
  process.exit(0);
}
if (existing.status !== 1) throw new Error(existing.stderr.trim() || 'Cannot read Git hooks path.');

const configured = git(['config', '--local', 'core.hooksPath', '.githooks']);
if (configured.error || configured.status !== 0) {
  throw new Error(configured.stderr?.trim() || 'Cannot enable repository Git hooks.');
}
console.log('Enabled repository Git hooks at .githooks.');
