import { spawnSync } from 'node:child_process';
import prettier from 'prettier';

const git = (args, options = {}) => {
  const result = spawnSync('git', args, { ...options, maxBuffer: 32 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(result.stderr?.toString().trim() || `git ${args[0]} failed`);
  }
  return result.stdout;
};

const stagedFiles = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const unformatted = [];

for (const path of stagedFiles) {
  const { ignored, inferredParser } = await prettier.getFileInfo(path, {
    ignorePath: '.prettierignore',
  });
  if (ignored || !inferredParser) continue;

  const source = git(['show', `:${path}`]).toString('utf8');
  const options = (await prettier.resolveConfig(path)) ?? {};
  if (!(await prettier.check(source, { ...options, filepath: path }))) unformatted.push(path);
}

if (unformatted.length > 0) {
  console.error('Staged files need formatting:');
  for (const path of unformatted) console.error(`  ${path}`);
  console.error('Run pnpm format, then stage the formatted files again.');
  process.exitCode = 1;
} else {
  console.log(`Checked formatting of ${stagedFiles.length} staged file(s).`);
}
