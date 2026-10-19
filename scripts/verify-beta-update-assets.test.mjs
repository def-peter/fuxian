import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
const execute = promisify(execFile);
const script = resolve('scripts/verify-update-assets.mjs');

describe('release asset validation', () => {
  it.each(['0.1.27', '0.1.27-beta.1'])(
    'validates complete %s assets and rejects mixed feeds and corruption',
    async (version) => {
      const directory = await mkdtemp(join(tmpdir(), 'fuxian-release-assets-'));
      const assets = join(directory, 'assets');
      try {
        await mkdir(assets);
        await writeFile(join(directory, 'package.json'), JSON.stringify({ version }));
        const contents = Buffer.from('fixture installer bytes');
        const names = [
          `fuxian-${version}-windows-x64-setup.exe`,
          ...['x64', 'arm64'].flatMap((arch) => [
            `fuxian-${version}-mac-${arch}.zip`,
            `fuxian-${version}-mac-${arch}.dmg`,
          ]),
        ];
        for (const name of names) {
          await writeFile(join(assets, name), contents);
          if (!name.endsWith('.dmg')) await writeFile(join(assets, `${name}.blockmap`), 'blockmap');
        }
        const channel = version.includes('-beta.') ? 'beta' : 'latest';
        for (const [suffix, predicate] of [
          ['', 'windows'],
          ['-mac', 'mac'],
        ]) {
          const metadata = {
            version,
            files: names
              .filter((name) => name.includes(predicate))
              .map((url) => ({
                url,
                size: contents.length,
                sha512: createHash('sha512').update(contents).digest('base64'),
              })),
          };
          await writeFile(join(assets, `${channel}${suffix}.yml`), stringify(metadata));
        }
        const run = () => execute(process.execPath, [script, assets], { cwd: directory });
        await expect(run()).resolves.toMatchObject({
          stdout: expect.stringContaining('Verified 10 updater assets'),
        });
        if (channel === 'beta') {
          await writeFile(join(assets, 'latest.yml'), 'version: 0.1.27-beta.1');
          await expect(run()).rejects.toThrow('must not contain stable updater metadata');
          await rm(join(assets, 'latest.yml'));
        }
        await writeFile(join(assets, names[0]), 'corrupt');
        await expect(run()).rejects.toThrow('wrong SHA-512');
      } finally {
        await rm(directory, { force: true, recursive: true });
      }
    },
  );
});
