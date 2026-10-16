import { EventEmitter } from 'node:events';
import { watch, type FSWatcher } from 'node:fs';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
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

class SilentNativeWatcher extends EventEmitter implements FSWatcher {
  close = vi.fn();

  ref(): this {
    return this;
  }

  unref(): this {
    return this;
  }
}

afterEach(async () => {
  for (const watcher of watchers.splice(0)) watcher.close();
  vi.resetAllMocks();
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('SourceDocumentWatcher without native change notifications', () => {
  it.each(['silent', 'unavailable', 'errored'])(
    'detects real updates when native watching is %s',
    async (mode) => {
      const nativeWatchers: EventEmitter[] = [];
      vi.mocked(watch).mockImplementation(() => {
        if (mode === 'unavailable') throw new Error('Watching is unavailable');
        const nativeWatcher = new SilentNativeWatcher();
        nativeWatchers.push(nativeWatcher);
        return nativeWatcher;
      });
      const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-silent-'));
      directories.push(directory);
      const path = join(directory, 'document.md');
      await writeFile(path, '# Initial');
      const changed = vi.fn();
      const watcher = new SourceDocumentWatcher(changed, {
        settleMilliseconds: 20,
        pollingMilliseconds: 25,
      });
      watchers.push(watcher);
      watcher.configure([path]);
      // Let the initial fingerprint settle before changing the real file.
      await new Promise((done) => setTimeout(done, 100));
      if (mode === 'errored') {
        for (const nativeWatcher of nativeWatchers)
          nativeWatcher.emit('error', new Error('Disconnected'));
        await new Promise((done) => setTimeout(done, 100));
      }
      expect(changed).not.toHaveBeenCalled();
      await writeFile(path, '# Updated through a filesystem with no notifications');
      await expect.poll(() => changed.mock.calls.length, { timeout: 1_000 }).toBe(1);
      await new Promise((done) => setTimeout(done, 150));
      expect(changed).toHaveBeenCalledTimes(1);
    },
  );

  it('detects atomic replacement, resource updates, deletion and recreation without events', async () => {
    vi.mocked(watch).mockImplementation(() => {
      return new SilentNativeWatcher();
    });
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-replace-'));
    directories.push(directory);
    const sourcePath = join(directory, 'document.md');
    const resourcePath = join(directory, 'image.svg');
    await writeFile(sourcePath, '# Initial');
    await writeFile(resourcePath, 'initial image');
    const changed = vi.fn();
    const watcher = new SourceDocumentWatcher(changed, {
      settleMilliseconds: 20,
      pollingMilliseconds: 25,
    });
    watchers.push(watcher);
    watcher.configure([sourcePath, resourcePath]);
    await new Promise((done) => setTimeout(done, 100));

    const replacementPath = join(directory, 'replacement.md');
    await writeFile(replacementPath, '# Atomic save');
    await rename(replacementPath, sourcePath);
    await expect.poll(() => changed.mock.calls.length).toBe(1);
    await writeFile(resourcePath, 'updated referenced image');
    await expect.poll(() => changed.mock.calls.length).toBe(2);
    await rm(sourcePath);
    await expect.poll(() => changed.mock.calls.length).toBe(3);
    await writeFile(sourcePath, '# Recreated');
    await expect.poll(() => changed.mock.calls.length).toBe(4);
  });

  it('stops polling obsolete and closed documents', async () => {
    vi.mocked(watch).mockImplementation(() => {
      return new SilentNativeWatcher();
    });
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-reconfigure-'));
    directories.push(directory);
    const oldPath = join(directory, 'old.md');
    const activePath = join(directory, 'active.md');
    await writeFile(oldPath, '# Old');
    await writeFile(activePath, '# Active');
    const changed = vi.fn();
    const watcher = new SourceDocumentWatcher(changed, {
      settleMilliseconds: 20,
      pollingMilliseconds: 25,
    });
    watchers.push(watcher);
    watcher.configure([oldPath]);
    await new Promise((done) => setTimeout(done, 100));
    watcher.configure([activePath]);
    await new Promise((done) => setTimeout(done, 100));
    await writeFile(oldPath, '# Obsolete update');
    await new Promise((done) => setTimeout(done, 150));
    expect(changed).not.toHaveBeenCalled();
    await writeFile(activePath, '# Latest');
    await expect.poll(() => changed.mock.calls.length).toBe(1);
    watcher.close();
    await writeFile(activePath, '# Closed update');
    await new Promise((done) => setTimeout(done, 150));
    expect(changed).toHaveBeenCalledTimes(1);
  });
});
