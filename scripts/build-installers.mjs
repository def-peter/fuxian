import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { releaseChannel } from './release-version.mjs';

// electron-builder's GitHub publisher does not infer metadata channels from SemVer.
export const installerArguments = (version, arguments_) => [
  'exec',
  'electron-builder',
  ...arguments_,
  `--config.publish.channel=${releaseChannel(version)}`,
];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    installerArguments(version, process.argv.slice(2)),
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
