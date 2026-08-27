import type { DocumentHeading } from '@fuxian/markdown-renderer';
import type { SourceDocumentData } from '@fuxian/shared-types';

export const recentDocumentLimit = 10;
export const recentDocumentMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

export interface FinishedSourceDocument {
  document: SourceDocumentData;
  headings: DocumentHeading[];
  html: string;
}

export interface SessionDocument extends FinishedSourceDocument {
  lastOpenedAt: number;
}

export interface DocumentSession {
  activeDocumentPath: string | undefined;
  openDocuments: SessionDocument[];
  recentDocuments: SessionDocument[];
}

export const createDocumentSession = (): DocumentSession => ({
  activeDocumentPath: undefined,
  openDocuments: [],
  recentDocuments: [],
});

export const pruneRecentDocuments = (
  documents: readonly SessionDocument[],
  now: number,
): SessionDocument[] => {
  const oldestAllowedTime = now - recentDocumentMaxAgeMs;
  const paths = new Set<string>();

  return documents
    .filter((document) => document.lastOpenedAt >= oldestAllowedTime)
    .filter((document) => {
      if (paths.has(document.document.path)) {
        return false;
      }
      paths.add(document.document.path);
      return true;
    })
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, recentDocumentLimit);
};

export const addDocumentsToSession = (
  session: DocumentSession,
  documents: readonly FinishedSourceDocument[],
  now: number,
): DocumentSession => {
  const incoming = new Map<string, FinishedSourceDocument>();
  for (const document of documents) {
    if (!incoming.has(document.document.path)) {
      incoming.set(document.document.path, document);
    }
  }

  const activeDocumentPath = incoming.keys().next().value as string | undefined;
  if (!activeDocumentPath) {
    return { ...session, recentDocuments: pruneRecentDocuments(session.recentDocuments, now) };
  }

  const existingPaths = new Set(session.openDocuments.map((document) => document.document.path));
  const openDocuments = session.openDocuments.map((document) =>
    incoming.has(document.document.path) ? { ...document, lastOpenedAt: now } : document,
  );
  for (const document of incoming.values()) {
    if (!existingPaths.has(document.document.path)) {
      openDocuments.push({ ...document, lastOpenedAt: now });
    }
  }

  const incomingPaths = new Set(incoming.keys());
  return {
    activeDocumentPath,
    openDocuments,
    recentDocuments: pruneRecentDocuments(
      session.recentDocuments.filter((document) => !incomingPaths.has(document.document.path)),
      now,
    ),
  };
};

export const activateDocument = (session: DocumentSession, path: string): DocumentSession =>
  session.openDocuments.some((document) => document.document.path === path)
    ? { ...session, activeDocumentPath: path }
    : session;

export const closeDocument = (
  session: DocumentSession,
  path: string,
  now: number,
): DocumentSession => {
  const closingIndex = session.openDocuments.findIndex(
    (document) => document.document.path === path,
  );
  const closingDocument = session.openDocuments[closingIndex];
  if (!closingDocument) {
    return session;
  }

  const openDocuments = session.openDocuments.filter((document) => document.document.path !== path);
  const nextActiveDocument = openDocuments[Math.min(closingIndex, openDocuments.length - 1)];
  return {
    activeDocumentPath:
      session.activeDocumentPath === path
        ? nextActiveDocument?.document.path
        : session.activeDocumentPath,
    openDocuments,
    recentDocuments: pruneRecentDocuments(
      [
        closingDocument,
        ...session.recentDocuments.filter((document) => document.document.path !== path),
      ],
      now,
    ),
  };
};

export const reopenRecentDocument = (
  session: DocumentSession,
  path: string,
  now: number,
): DocumentSession => {
  const recentDocument = session.recentDocuments.find(
    (document) => document.document.path === path,
  );
  if (!recentDocument) {
    return session;
  }

  return {
    activeDocumentPath: path,
    openDocuments: [...session.openDocuments, { ...recentDocument, lastOpenedAt: now }],
    recentDocuments: pruneRecentDocuments(
      session.recentDocuments.filter((document) => document.document.path !== path),
      now,
    ),
  };
};
