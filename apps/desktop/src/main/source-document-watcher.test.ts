import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SourceDocumentWatcher } from './source-document-watcher';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('SourceDocumentWatcher', () => {
  it('coalesces burst writes and observes referenced resource changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-'));
    temporaryDirectories.push(directory);
    const sourcePath = join(directory, 'document.md');
    const resourcePath = join(directory, 'diagram.png');
    await writeFile(sourcePath, '# Initial');
    await writeFile(resourcePath, 'initial image');
    const changed = vi.fn();
    const watcher = new SourceDocumentWatcher(changed, { settleMilliseconds: 25 });
    watcher.configure([sourcePath, resourcePath]);

    await writeFile(sourcePath, '# Partial');
    await writeFile(sourcePath, '# Complete revision');
    await expect.poll(() => changed.mock.calls.length).toBe(1);

    await writeFile(resourcePath, 'updated image');
    await expect.poll(() => changed.mock.calls.length).toBe(2);
    watcher.close();
  });

  it('stops obsolete watches when reconfigured', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-'));
    temporaryDirectories.push(directory);
    const oldPath = join(directory, 'old.md');
    const activePath = join(directory, 'active.md');
    await writeFile(oldPath, '# Old');
    await writeFile(activePath, '# Active');
    const changed = vi.fn();
    const watcher = new SourceDocumentWatcher(changed, { settleMilliseconds: 25 });
    watcher.configure([oldPath]);
    watcher.configure([activePath]);

    await writeFile(oldPath, '# Obsolete');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 120));
    expect(changed).not.toHaveBeenCalled();

    await writeFile(activePath, '# Latest');
    await expect.poll(() => changed.mock.calls.length).toBe(1);
    watcher.close();
  });

  it('observes when an ancestor directory of the source document is renamed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-watch-directory-'));
    temporaryDirectories.push(directory);
    const originalDirectory = join(directory, 'original', 'nested');
    const renamedDirectory = join(directory, 'renamed');
    const sourcePath = join(originalDirectory, 'document.md');
    await mkdir(originalDirectory, { recursive: true });
    await writeFile(sourcePath, '# Initial');
    const changed = vi.fn();
    const watcher = new SourceDocumentWatcher(changed, { settleMilliseconds: 25 });
    watcher.configure([sourcePath]);

    await rename(join(directory, 'original'), renamedDirectory);

    await expect.poll(() => changed.mock.calls.length).toBe(1);
    watcher.close();
  });
});
