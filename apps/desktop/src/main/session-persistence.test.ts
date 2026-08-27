import type { PersistedDocumentSession } from '@fuxian/shared-types';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createEmptyPersistedDocumentSession,
  JsonFileSessionPersistence,
  MemorySessionPersistence,
} from './session-persistence';

const temporaryDirectories: string[] = [];

const sessionFixture = (): PersistedDocumentSession => ({
  activeDocumentPath: '/docs/guide.md',
  openDocuments: [
    {
      lastOpenedAt: 1_787_788_800_000,
      name: 'guide.md',
      path: '/docs/guide.md',
      readingPosition: {
        headingId: 'configuration',
        headingOffset: 24,
        relativeProgress: 0.42,
      },
    },
  ],
  recentDocuments: [],
  version: 1,
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('session persistence', () => {
  it('keeps memory snapshots isolated from callers', async () => {
    const original = sessionFixture();
    const persistence = new MemorySessionPersistence(original);
    original.openDocuments[0]!.name = 'changed.md';

    const loaded = await persistence.load();
    loaded.openDocuments[0]!.name = 'also-changed.md';

    expect((await persistence.load()).openDocuments[0]?.name).toBe('guide.md');
  });

  it('loads an empty session when the JSON file is missing or corrupt', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-session-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'document-session.json');
    const persistence = new JsonFileSessionPersistence(path);

    expect(await persistence.load()).toEqual(createEmptyPersistedDocumentSession());
    await writeFile(path, '{invalid', 'utf8');
    expect(await persistence.load()).toEqual(createEmptyPersistedDocumentSession());

    await writeFile(
      path,
      JSON.stringify({ ...sessionFixture(), activeDocumentPath: '/docs/not-open.md' }),
      'utf8',
    );
    expect(await persistence.load()).toEqual(createEmptyPersistedDocumentSession());
  });

  it('atomically saves and reloads a valid session', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-session-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'document-session.json');
    const persistence = new JsonFileSessionPersistence(path);
    const session = sessionFixture();

    await persistence.save(session);

    expect(await persistence.load()).toEqual(session);
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual(session);
  });
});
