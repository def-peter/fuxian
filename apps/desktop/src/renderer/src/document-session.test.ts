import type { SourceDocumentData } from '@fuxian/shared-types';
import { describe, expect, it } from 'vitest';
import {
  activateDocument,
  addDocumentsToSession,
  closeDocument,
  createDocumentSession,
  pruneRecentDocuments,
  recentDocumentMaxAgeMs,
  reopenRecentDocument,
  type FinishedSourceDocument,
  type SessionDocument,
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
});

describe('document session', () => {
  it('adds multiple documents, activates the first selection, and deduplicates canonical paths', () => {
    const now = Date.UTC(2026, 7, 27);
    const first = finishedDocument('/docs/first.md');
    const second = finishedDocument('/docs/second.md');
    const added = addDocumentsToSession(createDocumentSession(), [first, second, first], now);
    const reopened = addDocumentsToSession(added, [second], now + 1);

    expect(added.openDocuments.map(({ document }) => document.path)).toEqual([
      '/docs/first.md',
      '/docs/second.md',
    ]);
    expect(added.activeDocumentPath).toBe('/docs/first.md');
    expect(reopened.openDocuments).toHaveLength(2);
    expect(reopened.activeDocumentPath).toBe('/docs/second.md');
  });

  it('switches, closes, and reopens documents without losing rendered content', () => {
    const now = Date.UTC(2026, 7, 27);
    const added = addDocumentsToSession(
      createDocumentSession(),
      [finishedDocument('/docs/first.md'), finishedDocument('/docs/second.md')],
      now,
    );
    const activated = activateDocument(added, '/docs/second.md');
    const closed = closeDocument(activated, '/docs/second.md', now + 1);
    const reopened = reopenRecentDocument(closed, '/docs/second.md', now + 2);

    expect(closed.activeDocumentPath).toBe('/docs/first.md');
    expect(closed.recentDocuments[0]?.document.path).toBe('/docs/second.md');
    expect(closed.recentDocuments[0]?.lastOpenedAt).toBe(now);
    expect(reopened.activeDocumentPath).toBe('/docs/second.md');
    expect(reopened.openDocuments[1]?.html).toContain('/docs/second.md');
    expect(reopened.recentDocuments).toHaveLength(0);
  });

  it('keeps at most ten recent documents and expires entries after thirty days', () => {
    const now = Date.UTC(2026, 7, 27);
    const recentDocuments: SessionDocument[] = Array.from({ length: 12 }, (_, index) => ({
      ...finishedDocument(`/docs/${index}.md`),
      lastOpenedAt: now - index,
    }));
    recentDocuments.push({
      ...finishedDocument('/docs/expired.md'),
      lastOpenedAt: now - recentDocumentMaxAgeMs - 1,
    });

    const pruned = pruneRecentDocuments(recentDocuments, now);

    expect(pruned).toHaveLength(10);
    expect(pruned.map(({ document }) => document.path)).toEqual(
      Array.from({ length: 10 }, (_, index) => `/docs/${index}.md`),
    );
    expect(pruned.some(({ document }) => document.path === '/docs/expired.md')).toBe(false);
  });
});
