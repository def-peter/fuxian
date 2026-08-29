import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { OpenDocumentWatchCoordinator } from './open-document-watch-coordinator';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe('OpenDocumentWatchCoordinator', () => {
  it('delivers active and delayed inactive changes without dropping either document', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-open-watch-'));
    temporaryDirectories.push(directory);
    const activePath = join(directory, 'active.md');
    const inactivePath = join(directory, 'inactive.md');
    await writeFile(activePath, '# Active');
    await writeFile(inactivePath, '# Inactive');
    const changes: string[] = [];
    const coordinator = new OpenDocumentWatchCoordinator((path) => changes.push(path), {
      inactiveDelayMilliseconds: 120,
      settleMilliseconds: 20,
    });
    coordinator.configure(
      [
        { path: activePath, watchedPaths: [activePath] },
        { path: inactivePath, watchedPaths: [inactivePath] },
      ],
      activePath,
    );
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 40));

    await writeFile(inactivePath, '# Inactive revision');
    await writeFile(activePath, '# Active revision');

    await expect.poll(() => changes.length).toBe(2);
    expect(changes.toSorted()).toEqual([activePath, inactivePath].toSorted());
    coordinator.close();
  });

  it('promotes a pending inactive change when its document becomes active', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-open-watch-'));
    temporaryDirectories.push(directory);
    const firstPath = join(directory, 'first.md');
    const secondPath = join(directory, 'second.md');
    await writeFile(firstPath, '# First');
    await writeFile(secondPath, '# Second');
    const changes: string[] = [];
    const targets = [
      { path: firstPath, watchedPaths: [firstPath] },
      { path: secondPath, watchedPaths: [secondPath] },
    ];
    const coordinator = new OpenDocumentWatchCoordinator((path) => changes.push(path), {
      inactiveDelayMilliseconds: 300,
      settleMilliseconds: 20,
    });
    coordinator.configure(targets, firstPath);
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 40));

    await writeFile(secondPath, '# Second revision');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 60));
    coordinator.configure(targets, secondPath);

    await expect.poll(() => changes).toEqual([secondPath]);
    coordinator.close();
  });
});
