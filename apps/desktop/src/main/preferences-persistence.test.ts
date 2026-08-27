import type { ReaderPreferences } from '@fuxian/shared-types';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  JsonFilePreferencesPersistence,
  MemoryPreferencesPersistence,
} from './preferences-persistence';

const temporaryDirectories: string[] = [];

const preferencesFixture = (): ReaderPreferences => ({
  appearance: 'dark',
  documentTypography: { bodyFamily: 'sans-serif', bodySize: 19, lineHeight: 1.7 },
  documentWidth: { customWidth: 940, mode: 'custom' },
  plantUml: { serverUrl: 'http://127.0.0.1:8080/plantuml' },
  version: 1,
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('preferences persistence', () => {
  it('keeps deterministic memory snapshots isolated from callers', async () => {
    const original = preferencesFixture();
    const persistence = new MemoryPreferencesPersistence(original);
    original.documentTypography.bodySize = 14;
    const loaded = await persistence.load();
    loaded.documentWidth.customWidth = 640;

    expect(await persistence.load()).toEqual(preferencesFixture());
  });

  it('loads defaults for missing and malformed files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-preferences-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'reader-preferences.json');
    const persistence = new JsonFilePreferencesPersistence(path);

    expect(await persistence.load()).toMatchObject({ appearance: 'system', version: 1 });
    await writeFile(path, '{broken', 'utf8');
    expect(await persistence.load()).toMatchObject({ appearance: 'system', version: 1 });
  });

  it('atomically saves normalized preferences and reloads them', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-preferences-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'reader-preferences.json');
    const persistence = new JsonFilePreferencesPersistence(path);
    const preferences = preferencesFixture();

    expect(await persistence.save(preferences)).toEqual(preferences);
    expect(await persistence.load()).toEqual(preferences);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(preferences);
  });
});
