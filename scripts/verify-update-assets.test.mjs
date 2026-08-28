import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { stringify } from 'yaml';
import { afterEach, describe, expect, it } from 'vitest';

const execute = promisify(execFile);
const temporaryDirectories = [];
const repositoryRoot = resolve(import.meta.dirname, '..');
const verifierPath = resolve(import.meta.dirname, 'verify-update-assets.mjs');
const version = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8')).version;

const checksum = (contents) => createHash('sha512').update(contents).digest('base64');

const createAsset = async (directory, name, contents = `asset:${name}`) => {
  await writeFile(join(directory, name), contents);
  return { contents, name };
};

const createFixture = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fuxian-update-assets-'));
  temporaryDirectories.push(directory);
  const windows = await createAsset(directory, `fuxian-${version}-windows-x64-setup.exe`);
  const macX64 = await createAsset(directory, `fuxian-${version}-mac-x64.zip`);
  const macArm64 = await createAsset(directory, `fuxian-${version}-mac-arm64.zip`);

  for (const name of [
    `${windows.name}.blockmap`,
    `fuxian-${version}-mac-x64.dmg`,
    `${macX64.name}.blockmap`,
    `fuxian-${version}-mac-arm64.dmg`,
    `${macArm64.name}.blockmap`,
  ]) {
    await createAsset(directory, name);
  }

  const metadataEntry = ({ contents, name }) => ({
    sha512: checksum(contents),
    size: Buffer.byteLength(contents),
    url: name,
  });
  await writeFile(
    join(directory, 'latest.yml'),
    stringify({ files: [metadataEntry(windows)], version }),
  );
  await writeFile(
    join(directory, 'latest-mac.yml'),
    stringify({ files: [metadataEntry(macX64), metadataEntry(macArm64)], version }),
  );
  return { directory, macX64 };
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe('verify-update-assets', () => {
  it('accepts a complete release and rejects altered update content', async () => {
    const { directory, macX64 } = await createFixture();

    await expect(
      execute(process.execPath, [verifierPath, directory], { cwd: repositoryRoot }),
    ).resolves.toMatchObject({ stdout: expect.stringContaining('Verified 10 updater assets') });

    await writeFile(join(directory, macX64.name), 'altered');
    await expect(
      execute(process.execPath, [verifierPath, directory], { cwd: repositoryRoot }),
    ).rejects.toMatchObject({ stderr: expect.stringContaining('wrong SHA-512') });
  });
});
