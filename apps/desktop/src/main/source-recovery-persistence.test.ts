import type { SourceRecoveryDraft } from '@fuxian/shared-types';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  JsonFileSourceRecoveryPersistence,
  MemorySourceRecoveryPersistence,
} from './source-recovery-persistence';

const temporaryDirectories: string[] = [];

const draftFixture = (path = '/documents/guide.md', updatedAt = 42): SourceRecoveryDraft => ({
  baselineSource: '# Saved',
  name: 'guide.md',
  path,
  selection: { anchor: 7, head: 7 },
  source: '# Local',
  updatedAt,
  version: 1,
});

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe('source recovery persistence', () => {
  it('keeps memory snapshots isolated and replaces drafts by path', async () => {
    const persistence = new MemorySourceRecoveryPersistence();
    const draft = draftFixture();
    await persistence.save(draft);
    draft.source = 'mutated';
    await persistence.save({ ...draftFixture(), source: '# Latest', updatedAt: 43 });

    const loaded = await persistence.load();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({ source: '# Latest', updatedAt: 43 });
    loaded[0]!.source = 'mutated again';
    expect((await persistence.load())[0]?.source).toBe('# Latest');
  });

  it('atomically saves, removes, and reloads drafts', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-source-drafts-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'source-recovery-drafts.json');
    const persistence = new JsonFileSourceRecoveryPersistence(path);

    await persistence.save(draftFixture());
    await persistence.save(draftFixture('/documents/second.md', 43));
    expect(await persistence.load()).toHaveLength(2);
    await persistence.remove('/documents/guide.md');
    expect(await persistence.load()).toEqual([
      expect.objectContaining({ path: '/documents/second.md' }),
    ]);
    expect(JSON.parse(await readFile(path, 'utf8'))).toMatchObject({ version: 1 });
  });

  it('ignores malformed recovery data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-source-drafts-'));
    temporaryDirectories.push(directory);
    const path = join(directory, 'source-recovery-drafts.json');
    const persistence = new JsonFileSourceRecoveryPersistence(path);
    await writeFile(path, JSON.stringify({ drafts: [{ path: '/bad.md' }], version: 1 }), 'utf8');

    expect(await persistence.load()).toEqual([]);
  });
});
