import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AppUpdateChannelPersistence, classifyUpdate } from './app-update-channel';

describe('update channel persistence', () => {
  it('defaults stable and persists channel independently without rewriting existing user data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fuxian-channels-'));
    try {
      const path = join(directory, 'app-update-channel.json');
      const preferences = join(directory, 'reader-preferences.json');
      const original = '{"version":1,"theme":"dark"}\n';
      await writeFile(preferences, original);
      const store = new AppUpdateChannelPersistence(path);
      await expect(store.load()).resolves.toBe('stable');
      await store.save('beta');
      await expect(new AppUpdateChannelPersistence(path).load()).resolves.toBe('beta');
      await Promise.all([store.save('stable'), store.save('beta'), store.save('stable')]);
      await expect(store.load()).resolves.toBe('stable');
      expect(await readFile(preferences, 'utf8')).toBe(original);
      for (const malformed of [
        '{broken',
        '{"version":2,"channel":"beta"}',
        '{"version":1,"channel":"alpha"}',
      ]) {
        await writeFile(path, malformed);
        await expect(store.load()).resolves.toBe('stable');
      }
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});

describe('update version policy', () => {
  it.each([
    ['0.1.0', '0.1.1', 'stable', 'upgrade'],
    ['0.1.0', '0.2.0-beta.1', 'stable', undefined],
    ['0.1.0', '0.2.0-beta.1', 'beta', 'upgrade'],
    ['0.2.0-beta.9', '0.2.0-beta.10', 'beta', 'upgrade'],
    ['0.2.0-beta.10', '0.2.0-beta.9', 'beta', undefined],
    ['0.2.0-beta.2', '0.2.0', 'beta', 'upgrade'],
    ['0.2.0-beta.2', '0.1.9', 'stable', 'downgrade'],
    ['0.2.0-test.16', '0.1.9', 'stable', 'downgrade'],
    ['0.2.0-beta.2', '0.1.9', 'beta', undefined],
    ['0.2.0', '0.1.9', 'stable', undefined],
    ['0.2.0', '0.2.0', 'stable', undefined],
    ['0.1.0', '0.2.0-test.1', 'beta', undefined],
    ['0.1.0', '0.2.0-beta.1+build.5', 'beta', undefined],
  ] as const)('%s -> %s on %s is %s', (current, candidate, channel, result) => {
    expect(classifyUpdate(current, candidate, channel)).toBe(result);
  });
});
