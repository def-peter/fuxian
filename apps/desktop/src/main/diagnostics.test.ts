import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PersistedDocumentSession } from '@fuxian/shared-types';
import { Diagnostics, diagnosticError } from './diagnostics';

const directories: string[] = [];
const directory = () => {
  const path = mkdtempSync(join(tmpdir(), 'fuxian-diagnostics-'));
  directories.push(path);
  return path;
};
const environment = { version: '0.1.21', platform: 'darwin', arch: 'arm64', electron: '44' };
const readRecords = (diagnostics: Diagnostics) =>
  diagnostics
    .exportText()
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});

describe('local diagnostics', () => {
  it('records session changes and matching revisions without storing document identity or reading state', () => {
    const diagnostics = new Diagnostics(directory(), environment);
    const path = '/Users/PRIVATE/secret-project/工资清单.md';
    const session: PersistedDocumentSession = {
      version: 1,
      activeDocumentPath: path,
      recentDocuments: [],
      openDocuments: [
        {
          path,
          name: '工资清单.md',
          lastOpenedAt: Date.now(),
          readingPosition: { headingId: 'secret-heading', headingOffset: 1, relativeProgress: 0.2 },
        },
      ],
    };
    diagnostics.session('session.loaded', session);
    const saved = diagnostics.session('session.accepted', session);
    expect(saved.changed).toBe(false);
    const closed = diagnostics.session('session.accepted', {
      version: 1,
      openDocuments: [],
      recentDocuments: [{ path, name: '工资清单.md', lastOpenedAt: Date.now() }],
    });
    expect(closed).toEqual({ revision: 2, changed: true });
    const record = readRecords(diagnostics).findLast((item) => item.event === 'session.accepted');
    expect(record).toMatchObject({
      previousOpenCount: 1,
      openCount: 0,
      recentCount: 1,
      revision: 2,
    });
    expect(record.removedOpen).toEqual(record.recent);
    for (const privateText of [
      'PRIVATE',
      'secret-project',
      '工资清单',
      'secret-heading',
      'relativeProgress',
    ]) {
      expect(diagnostics.exportText()).not.toContain(privateText);
    }
    diagnostics.close();
  });

  it('does not persist raw error messages, names, codes, URLs, or private stack locations', () => {
    const diagnostics = new Diagnostics(directory(), environment);
    const error = {
      name: 'PRIVATE-NAME',
      code: 'SECRET-TOKEN',
      message: '私人正文 https://user:password@private.host/path',
      stack:
        'Error: 私人正文\n at /Users/peter/Fuxian.app/Contents/Resources/app.asar/main/index.js:42:9\n at /Users/private/私人文档.md:12:2',
    };
    expect(diagnosticError(error)).toEqual({ type: 'Error', locations: ['main/index.js:42:9'] });
    diagnostics.failure('render.failed', error);
    for (const privateText of ['私人', 'password', 'SECRET', 'PRIVATE', '/Users', 'private.host']) {
      expect(diagnostics.exportText()).not.toContain(privateText);
    }
    expect(diagnosticError(Object.assign(new Error('secret'), { code: 'ENOENT' }))).toMatchObject({
      type: 'Error',
      code: 'ENOENT',
    });
    expect(
      diagnosticError(
        Object.defineProperty({}, 'stack', {
          get() {
            throw new Error('private');
          },
        }),
      ),
    ).toEqual({ type: 'Error' });
    diagnostics.close();
  });

  it('marks interrupted runs but distinguishes clean exits', () => {
    const path = directory();
    const first = new Diagnostics(path, environment);
    const id = first.documentId('/private/file.md');
    const afterCrash = new Diagnostics(path, environment);
    expect(afterCrash.documentId('/private/file.md')).toBe(id);
    expect(
      readRecords(afterCrash)
        .filter((item) => item.event === 'app.start')
        .map((item) => item.previousExitUnclean),
    ).toEqual([false, true]);
    afterCrash.close();
    const afterQuit = new Diagnostics(path, environment);
    expect(
      readRecords(afterQuit).findLast((item) => item.event === 'app.start').previousExitUnclean,
    ).toBe(false);
    afterQuit.close();
  });

  it('rotates logs and enforces age and total size limits', () => {
    const path = directory();
    let now = Date.UTC(2026, 8, 1);
    const diagnostics = new Diagnostics(path, environment, () => now, {
      days: 7,
      bytes: 5000,
      fileBytes: 700,
    });
    for (let day = 0; day < 10; day++) {
      now = Date.UTC(2026, 8, day + 1);
      for (let i = 0; i < 20; i++) diagnostics.record('test.event', { sequence: i });
      const files = readdirSync(path).filter((name) => name.endsWith('.log'));
      expect(
        files.reduce((sum, name) => sum + statSync(join(path, name)).size, 0),
      ).toBeLessThanOrEqual(5000);
    }
    expect(readdirSync(path).some((name) => name.includes('.old.log'))).toBe(true);
    now += 8 * 86_400_000;
    diagnostics.prune();
    expect(readdirSync(path).filter((name) => name.endsWith('.log'))).toEqual([]);
    diagnostics.close();
  });

  it('clears existing logs and rotates private identifiers without touching other files', () => {
    const path = directory();
    const diagnostics = new Diagnostics(path, environment);
    const id = diagnostics.documentId('/private/file.md');
    writeFileSync(join(path, 'unrelated.json'), 'keep');
    diagnostics.record('before.clear');
    diagnostics.clear();
    expect(diagnostics.documentId('/private/file.md')).not.toBe(id);
    expect(diagnostics.exportText()).not.toContain('before.clear');
    expect(diagnostics.exportText()).not.toContain('app.start');
    expect(readFileSync(join(path, 'unrelated.json'), 'utf8')).toBe('keep');
    diagnostics.record('after.clear');
    expect(diagnostics.exportText()).toContain('after.clear');
    diagnostics.close();
  });

  it('does not interrupt app work when the log directory cannot be created', () => {
    const path = join(directory(), 'not-a-directory');
    writeFileSync(path, 'file');
    const diagnostics = new Diagnostics(path, environment);
    expect(() => diagnostics.record('event')).not.toThrow();
    expect(() => diagnostics.failure('error', new Error('private'))).not.toThrow();
    expect(() => diagnostics.exportText()).toThrow('Diagnostics unavailable');
    expect(() => diagnostics.close()).not.toThrow();
  });
});
