import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceDocumentWatcher } from './source-document-watcher';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  watch: vi.fn(),
}));

const directories: string[] = [];
const watchers: SourceDocumentWatcher[] = [];

afterEach(async () => {
  for (const watcher of watchers.splice(0)) watcher.close();
  vi.resetAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('SourceDocumentWatcher initialization', () => {
  it('reports a document deleted before registration even without native events', async () => {
    vi.mocked(watch).mockImplementation(() => {
      const nativeWatcher = new EventEmitter();
      return Object.assign(nativeWatcher, { close: vi.fn() }) as unknown as FSWatcher;
    });
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-initial-missing-'));
    directories.push(directory);
    const path = join(directory, 'deleted.md');
    await writeFile(path, '# Opened before deletion');
    await rm(path);
    const changed = vi.fn();
    const watcher = new SourceDocumentWatcher(changed, {
      settleMilliseconds: 10,
      pollingMilliseconds: 20,
    });
    watchers.push(watcher);

    watcher.configure([path]);

    await expect.poll(() => changed.mock.calls.length, { timeout: 500 }).toBe(1);
    await new Promise((done) => setTimeout(done, 100));
    expect(changed).toHaveBeenCalledTimes(1);
    await writeFile(path, '# Recreated');
    await expect.poll(() => changed.mock.calls.length).toBe(2);
  });

  it.each(['reconfigure', 'close'])(
    'invalidates an initial missing result on %s',
    async (action) => {
      vi.mocked(watch).mockImplementation(() => {
        throw new Error('Watching is unavailable');
      });
      const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-initial-obsolete-'));
      directories.push(directory);
      const missingPath = join(directory, 'missing.md');
      const availablePath = join(directory, 'available.md');
      await writeFile(availablePath, '# Available');
      const changed = vi.fn();
      const watcher = new SourceDocumentWatcher(changed, {
        settleMilliseconds: 10,
        pollingMilliseconds: 20,
      });
      watchers.push(watcher);
      watcher.configure([missingPath]);

      if (action === 'reconfigure') watcher.configure([availablePath]);
      else watcher.close();

      await new Promise((done) => setTimeout(done, 100));
      expect(changed).not.toHaveBeenCalled();
    },
  );
});
