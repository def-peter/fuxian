import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  JsonFileAppUpdateStatePersistence,
  normalizeAppUpdateState,
} from './app-update-state-persistence';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('app update state persistence', () => {
  it('normalizes malformed or unsupported state', () => {
    expect(normalizeAppUpdateState(undefined)).toEqual({ version: 1 });
    expect(normalizeAppUpdateState({ lastNotifiedVersion: '0.2.0', version: 2 })).toEqual({
      version: 1,
    });
    expect(normalizeAppUpdateState({ lastNotifiedVersion: ' 0.2.0 ', version: 1 })).toEqual({
      lastNotifiedVersion: '0.2.0',
      version: 1,
    });
  });

  it('falls back from corrupt JSON and atomically persists the notified version', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-update-state-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'app-update-state.json');
    const persistence = new JsonFileAppUpdateStatePersistence(path);
    await writeFile(path, '{broken', 'utf8');

    await expect(persistence.load()).resolves.toEqual({ version: 1 });
    await persistence.saveLastNotifiedVersion('0.2.0');

    await expect(persistence.load()).resolves.toEqual({
      lastNotifiedVersion: '0.2.0',
      version: 1,
    });
    expect(await readFile(path, 'utf8')).toContain('"lastNotifiedVersion": "0.2.0"');
  });
});
