import type { PersistedDocumentReference, SourceDocumentData } from '@fuxian/shared-types';
import { describe, expect, it } from 'vitest';
import {
  applyFinishedDocumentRevision,
  beginReopenRecentDocument,
  activateDocument,
  addDocumentsToSession,
  closeDocument,
  createDocumentSession,
  createPersistedDocumentSession,
  createRestoredDocumentSession,
  failLoadingDocument,
  forgetDocument,
  pruneRecentDocuments,
  recentDocumentMaxAgeMs,
  reopenRecentDocument,
  updateReadingPosition,
  updateSourceDocumentRevision,
  type FinishedSourceDocument,
} from './document-session';

const finishedDocument = (path: string): FinishedSourceDocument => ({
  document: {
    name: path.split('/').at(-1) ?? path,
    path,
    resourceBaseUrl: `fuxian-resource://${path}`,
    source: `# ${path}`,
  } satisfies SourceDocumentData,
  headings: [],
  html: `<h1>${path}</h1>`,
  resourceUrls: [],
});

const reference = (
  path: string,
  lastOpenedAt: number,
  headingId?: string,
): PersistedDocumentReference => ({
  lastOpenedAt,
  name: path.split('/').at(-1) ?? path,
  path,
  readingPosition: {
    ...(headingId ? { headingId } : {}),
    headingOffset: headingId ? 24 : 0,
    relativeProgress: headingId ? 0.4 : 0,
  },
});

const openPaths = (session: ReturnType<typeof createDocumentSession>): string[] =>
  session.openDocuments.map((item) =>
    item.status === 'available' ? item.document.path : item.path,
  );

describe('document session', () => {
  it('applies a finished external revision without changing document identity', () => {
    const original = addDocumentsToSession(
      createDocumentSession(),
      [finishedDocument('/docs/reader.md')],
      42,
    );
    const revision = {
      ...finishedDocument('/docs/reader.md'),
      html: '<h1>Revised</h1>',
      resourceUrls: ['fuxian-resource://reader/updated.png'],
    };
    const readingPosition = { headingId: 'revised', headingOffset: 18, relativeProgress: 0.5 };

    const updated = applyFinishedDocumentRevision(
      original,
      '/docs/reader.md',
      revision,
      readingPosition,
    );

    expect(updated.openDocuments[0]).toMatchObject({
      html: '<h1>Revised</h1>',
      lastOpenedAt: 42,
      latestSourceDocument: revision.document,
      readingPosition,
      resourceUrls: revision.resourceUrls,
    });
  });

  it('tracks the latest source revision independently from the stable finished document', () => {
    const original = addDocumentsToSession(
      createDocumentSession(),
      [finishedDocument('/docs/reader.md')],
      42,
    );
    const latestSourceDocument = {
      ...finishedDocument('/docs/reader.md').document,
      source: '# Invalid revision\n\n```mermaid\nnot a diagram\n```',
    };

    const updated = updateSourceDocumentRevision(original, '/docs/reader.md', latestSourceDocument);

    expect(updated.openDocuments[0]).toMatchObject({
      document: { source: '# /docs/reader.md' },
      html: '<h1>/docs/reader.md</h1>',
      latestSourceDocument,
    });
  });

  it('reopens recent documents from cache or a loading placeholder', () => {
    const recent = {
      lastOpenedAt: 40,
      name: 'reader.md',
      path: '/docs/reader.md',
      readingPosition: { headingOffset: 8, relativeProgress: 0.6 },
    };
    const session = { ...createDocumentSession(), recentDocuments: [recent] };
    const loading = beginReopenRecentDocument(session, recent.path, undefined, 50);
    expect(loading).toMatchObject({
      activeDocumentPath: recent.path,
      openDocuments: [{ path: recent.path, status: 'loading' }],
      recentDocuments: [],
    });

    const loaded = applyFinishedDocumentRevision(
      loading,
      recent.path,
      finishedDocument(recent.path),
      recent.readingPosition,
    );
    expect(loaded.openDocuments[0]).toMatchObject({
      document: { path: recent.path },
      status: 'available',
    });

    const failed = failLoadingDocument(loading, recent.path, 'still being written');
    expect(failed.openDocuments[0]).toMatchObject({
      message: 'still being written',
      status: 'unavailable',
    });
  });

  it('adopts the canonical path returned when a recent document is reopened', () => {
    const aliasPath = '/docs/linked-reader.md';
    const canonicalPath = '/private/docs/reader.md';
    const recent = {
      lastOpenedAt: 40,
      name: 'linked-reader.md',
      path: aliasPath,
      readingPosition: { headingOffset: 0, relativeProgress: 0.25 },
    };
    const loading = beginReopenRecentDocument(
      { ...createDocumentSession(), recentDocuments: [recent] },
      aliasPath,
      undefined,
      50,
    );

    const loaded = applyFinishedDocumentRevision(
      loading,
      aliasPath,
      finishedDocument(canonicalPath),
      recent.readingPosition,
    );

    expect(loaded.activeDocumentPath).toBe(canonicalPath);
    expect(openPaths(loaded)).toEqual([canonicalPath]);
  });

  it('adds multiple documents, activates the first selection, and deduplicates canonical paths', () => {
    const now = Date.UTC(2026, 7, 27);
    const first = finishedDocument('/docs/first.md');
    const second = finishedDocument('/docs/second.md');
    const added = addDocumentsToSession(createDocumentSession(), [first, second, first], now);
    const reopened = addDocumentsToSession(added, [second], now + 1);

    expect(openPaths(added)).toEqual(['/docs/first.md', '/docs/second.md']);
    expect(added.activeDocumentPath).toBe('/docs/first.md');
    expect(reopened.openDocuments).toHaveLength(2);
    expect(reopened.activeDocumentPath).toBe('/docs/second.md');
  });

  it('switches, closes, and reopens documents while retaining the reading position', () => {
    const now = Date.UTC(2026, 7, 27);
    const added = addDocumentsToSession(
      createDocumentSession(),
      [finishedDocument('/docs/first.md'), finishedDocument('/docs/second.md')],
      now,
    );
    const activated = activateDocument(added, '/docs/second.md');
    const positioned = updateReadingPosition(activated, '/docs/second.md', {
      headingId: 'details',
      headingOffset: 36,
      relativeProgress: 0.6,
    });
    const closed = closeDocument(positioned, '/docs/second.md', now + 1);
    const reopened = reopenRecentDocument(
      closed,
      '/docs/second.md',
      finishedDocument('/docs/second.md'),
      now + 2,
    );

    expect(closed.activeDocumentPath).toBe('/docs/first.md');
    expect(closed.recentDocuments[0]?.path).toBe('/docs/second.md');
    expect(closed.recentDocuments[0]?.readingPosition).toEqual({
      headingId: 'details',
      headingOffset: 36,
      relativeProgress: 0.6,
    });
    expect(reopened.activeDocumentPath).toBe('/docs/second.md');
    expect(reopened.openDocuments[1]).toMatchObject({
      html: expect.stringContaining('/docs/second.md'),
      readingPosition: { headingId: 'details' },
      status: 'available',
    });
    expect(reopened.recentDocuments).toHaveLength(0);
  });

  it('drops missing open and recent documents while restoring the available session', () => {
    const now = Date.UTC(2026, 7, 27);
    const first = reference('/docs/first.md', now - 2);
    const missing = reference('/docs/missing.md', now - 1);
    const active = reference('/docs/active.md', now, 'chapter-two');
    const recentMissing = reference('/docs/recent-missing.md', now - 3);
    const recentAvailable = reference('/docs/recent.md', now - 4);
    const persisted = {
      activeDocumentPath: active.path,
      openDocuments: [first, missing, active],
      recentDocuments: [recentMissing, recentAvailable],
      version: 1 as const,
    };

    const restored = createRestoredDocumentSession(
      persisted,
      [
        { status: 'available', reference: first, document: finishedDocument(first.path) },
        {
          status: 'unavailable',
          reference: missing,
          message: 'File not found.',
          reason: 'missing',
        },
        { status: 'available', reference: active, document: finishedDocument(active.path) },
      ],
      now,
      { missingDocumentPaths: [missing.path, recentMissing.path] },
    );

    expect(openPaths(restored)).toEqual([first.path, active.path]);
    expect(restored.openDocuments.map(({ status }) => status)).toEqual(['available', 'available']);
    expect(restored.activeDocumentPath).toBe(active.path);
    expect(restored.recentDocuments).toEqual([recentAvailable]);
    expect(createPersistedDocumentSession(restored).openDocuments).toEqual([first, active]);
  });

  it('forgets a deleted document without adding it to recent history', () => {
    const now = Date.UTC(2026, 7, 27);
    const first = finishedDocument('/docs/first.md');
    const deleted = finishedDocument('/docs/deleted.md');
    const open = addDocumentsToSession(createDocumentSession(), [first, deleted], now);
    const session = {
      ...open,
      recentDocuments: [reference('/docs/deleted.md', now - 1), reference('/docs/recent.md', now)],
    };

    const forgotten = forgetDocument(session, deleted.document.path);

    expect(openPaths(forgotten)).toEqual([first.document.path]);
    expect(forgotten.activeDocumentPath).toBe(first.document.path);
    expect(forgotten.recentDocuments.map(({ path }) => path)).toEqual(['/docs/recent.md']);
  });

  it('falls back to the first available document when the persisted active document is unavailable', () => {
    const now = Date.UTC(2026, 7, 27);
    const missing = reference('/docs/missing.md', now);
    const available = reference('/docs/available.md', now);
    const restored = createRestoredDocumentSession(
      {
        activeDocumentPath: missing.path,
        openDocuments: [missing, available],
        recentDocuments: [],
        version: 1,
      },
      [
        {
          status: 'unavailable',
          reference: missing,
          message: 'File not found.',
          reason: 'missing',
        },
        {
          status: 'available',
          reference: available,
          document: finishedDocument(available.path),
        },
      ],
      now,
    );

    expect(restored.activeDocumentPath).toBe(available.path);
  });

  it('keeps at most ten recent documents and expires entries after thirty days', () => {
    const now = Date.UTC(2026, 7, 27);
    const recentDocuments = Array.from({ length: 12 }, (_, index) =>
      reference(`/docs/${index}.md`, now - index),
    );
    recentDocuments.push(reference('/docs/expired.md', now - recentDocumentMaxAgeMs - 1));

    const pruned = pruneRecentDocuments(recentDocuments, now);

    expect(pruned).toHaveLength(10);
    expect(pruned.map(({ path }) => path)).toEqual(
      Array.from({ length: 10 }, (_, index) => `/docs/${index}.md`),
    );
    expect(pruned.some(({ path }) => path === '/docs/expired.md')).toBe(false);
  });
});
