import type { DocumentHeading } from '@fuxian/markdown-renderer';
import type {
  PersistedDocumentReference,
  PersistedDocumentSession,
  ReadingPosition,
  SourceDocumentUnavailableReason,
  SourceDocumentData,
} from '@fuxian/shared-types';

export const recentDocumentLimit = 10;
export const recentDocumentMaxAgeMs = 30 * 24 * 60 * 60 * 1000;

export const createInitialReadingPosition = (): ReadingPosition => ({
  headingOffset: 0,
  relativeProgress: 0,
});

export interface FinishedSourceDocument {
  document: SourceDocumentData;
  headings: DocumentHeading[];
  html: string;
  resourceUrls: string[];
}

export interface SessionDocument extends FinishedSourceDocument {
  lastOpenedAt: number;
  latestSourceDocument: SourceDocumentData;
  readingPosition: ReadingPosition;
  status: 'available';
}

export interface UnavailableSessionDocument extends PersistedDocumentReference {
  message: string;
  reason: SourceDocumentUnavailableReason;
  status: 'unavailable';
}

export interface LoadingSessionDocument extends PersistedDocumentReference {
  status: 'loading';
}

export type OpenDocumentItem =
  LoadingSessionDocument | SessionDocument | UnavailableSessionDocument;
export type RecentDocument = PersistedDocumentReference;

export interface DocumentSession {
  activeDocumentPath: string | undefined;
  openDocuments: OpenDocumentItem[];
  recentDocuments: RecentDocument[];
}

export type RestoredFinishedDocument =
  | {
      document: FinishedSourceDocument;
      reference: PersistedDocumentReference;
      status: 'available';
    }
  | {
      message: string;
      reason: SourceDocumentUnavailableReason;
      reference: PersistedDocumentReference;
      status: 'unavailable';
    };

interface RestoreDocumentSessionOptions {
  missingDocumentPaths?: readonly string[];
  protectedDocumentPaths?: readonly string[];
}

const itemPath = (item: OpenDocumentItem): string =>
  item.status === 'available' ? item.latestSourceDocument.path : item.path;

const itemName = (item: OpenDocumentItem): string =>
  item.status === 'available' ? item.latestSourceDocument.name : item.name;

const createSessionDocument = (
  document: FinishedSourceDocument,
  lastOpenedAt: number,
  readingPosition: ReadingPosition,
): SessionDocument => ({
  ...document,
  lastOpenedAt,
  latestSourceDocument: document.document,
  readingPosition,
  status: 'available',
});

const toReference = (item: OpenDocumentItem): PersistedDocumentReference => ({
  lastOpenedAt: item.lastOpenedAt,
  name: itemName(item),
  path: itemPath(item),
  readingPosition: item.readingPosition,
});

export const createDocumentSession = (): DocumentSession => ({
  activeDocumentPath: undefined,
  openDocuments: [],
  recentDocuments: [],
});

export const pruneRecentDocuments = (
  documents: readonly RecentDocument[],
  now: number,
): RecentDocument[] => {
  const oldestAllowedTime = now - recentDocumentMaxAgeMs;
  const paths = new Set<string>();

  return documents
    .filter((document) => document.lastOpenedAt >= oldestAllowedTime)
    .filter((document) => {
      if (paths.has(document.path)) {
        return false;
      }
      paths.add(document.path);
      return true;
    })
    .sort((left, right) => right.lastOpenedAt - left.lastOpenedAt)
    .slice(0, recentDocumentLimit);
};

export const createRestoredDocumentSession = (
  persisted: PersistedDocumentSession,
  restoredDocuments: readonly RestoredFinishedDocument[],
  now: number,
  options: RestoreDocumentSessionOptions = {},
): DocumentSession => {
  const missingDocumentPaths = new Set(options.missingDocumentPaths);
  const protectedDocumentPaths = new Set(options.protectedDocumentPaths);
  const shouldKeepPath = (path: string): boolean =>
    !missingDocumentPaths.has(path) || protectedDocumentPaths.has(path);
  const openDocuments: OpenDocumentItem[] = restoredDocuments
    .filter((restored) => shouldKeepPath(restored.reference.path))
    .map((restored) =>
      restored.status === 'available'
        ? createSessionDocument(
            restored.document,
            restored.reference.lastOpenedAt,
            restored.reference.readingPosition,
          )
        : {
            ...restored.reference,
            message: restored.message,
            reason: restored.reason,
            status: 'unavailable',
          },
    );
  const requestedActive = openDocuments.find(
    (item): item is SessionDocument =>
      item.status === 'available' && item.document.path === persisted.activeDocumentPath,
  );
  const firstAvailable = openDocuments.find(
    (item): item is SessionDocument => item.status === 'available',
  );

  return {
    activeDocumentPath: requestedActive?.document.path ?? firstAvailable?.document.path,
    openDocuments,
    recentDocuments: pruneRecentDocuments(
      persisted.recentDocuments.filter((document) => shouldKeepPath(document.path)),
      now,
    ),
  };
};

export const createPersistedDocumentSession = (
  session: DocumentSession,
): PersistedDocumentSession => ({
  ...(session.activeDocumentPath ? { activeDocumentPath: session.activeDocumentPath } : {}),
  openDocuments: session.openDocuments.map(toReference),
  recentDocuments: session.recentDocuments,
  version: 1,
});

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

  const existingPaths = new Set(session.openDocuments.map(itemPath));
  const openDocuments = session.openDocuments.map((item): OpenDocumentItem => {
    const document = incoming.get(itemPath(item));
    if (!document) {
      return item;
    }
    return createSessionDocument(document, now, item.readingPosition);
  });
  for (const document of incoming.values()) {
    if (!existingPaths.has(document.document.path)) {
      openDocuments.push(createSessionDocument(document, now, createInitialReadingPosition()));
    }
  }

  const incomingPaths = new Set(incoming.keys());
  return {
    activeDocumentPath,
    openDocuments,
    recentDocuments: pruneRecentDocuments(
      session.recentDocuments.filter((document) => !incomingPaths.has(document.path)),
      now,
    ),
  };
};

export const activateDocument = (session: DocumentSession, path: string): DocumentSession =>
  session.openDocuments.some((item) => item.status !== 'unavailable' && itemPath(item) === path)
    ? { ...session, activeDocumentPath: path }
    : session;

export const updateReadingPosition = (
  session: DocumentSession,
  path: string,
  readingPosition: ReadingPosition,
): DocumentSession => ({
  ...session,
  openDocuments: session.openDocuments.map((item) =>
    itemPath(item) === path ? { ...item, readingPosition } : item,
  ),
});

const nextAvailablePath = (
  documents: readonly OpenDocumentItem[],
  closingIndex: number,
): string | undefined => {
  for (let offset = 0; offset < documents.length; offset += 1) {
    const item = documents[(closingIndex + offset) % documents.length];
    if (item && item.status !== 'unavailable') {
      return itemPath(item);
    }
  }
  return undefined;
};

export const closeDocument = (
  session: DocumentSession,
  path: string,
  now: number,
): DocumentSession => {
  const closingIndex = session.openDocuments.findIndex((item) => itemPath(item) === path);
  const closingDocument = session.openDocuments[closingIndex];
  if (!closingDocument) {
    return session;
  }

  const openDocuments = session.openDocuments.filter((item) => itemPath(item) !== path);
  return {
    activeDocumentPath:
      session.activeDocumentPath === path
        ? nextAvailablePath(openDocuments, closingIndex)
        : session.activeDocumentPath,
    openDocuments,
    recentDocuments: pruneRecentDocuments(
      [
        toReference(closingDocument),
        ...session.recentDocuments.filter((item) => item.path !== path),
      ],
      now,
    ),
  };
};

export const forgetDocument = (session: DocumentSession, path: string): DocumentSession => {
  const forgottenIndex = session.openDocuments.findIndex((item) => itemPath(item) === path);
  const openDocuments = session.openDocuments.filter((item) => itemPath(item) !== path);
  return {
    activeDocumentPath:
      session.activeDocumentPath === path
        ? nextAvailablePath(openDocuments, Math.max(0, forgottenIndex))
        : session.activeDocumentPath,
    openDocuments,
    recentDocuments: session.recentDocuments.filter((document) => document.path !== path),
  };
};

export const removeUnavailableDocument = (
  session: DocumentSession,
  path: string,
): DocumentSession => ({
  ...session,
  openDocuments: session.openDocuments.filter(
    (item) => item.status !== 'unavailable' || item.path !== path,
  ),
});

export const setUnavailableDocumentMessage = (
  session: DocumentSession,
  path: string,
  message: string,
): DocumentSession => ({
  ...session,
  openDocuments: session.openDocuments.map((item) =>
    item.status === 'unavailable' && item.path === path ? { ...item, message } : item,
  ),
});

export const applyFinishedDocumentRevision = (
  session: DocumentSession,
  path: string,
  document: FinishedSourceDocument,
  readingPosition: ReadingPosition,
): DocumentSession => {
  const documentPath = document.document.path;
  return {
    ...session,
    activeDocumentPath:
      session.activeDocumentPath === path ? documentPath : session.activeDocumentPath,
    openDocuments: session.openDocuments
      .filter((item) => itemPath(item) === path || itemPath(item) !== documentPath)
      .map((item): OpenDocumentItem =>
        item.status !== 'unavailable' && itemPath(item) === path
          ? {
              ...document,
              lastOpenedAt: item.lastOpenedAt,
              latestSourceDocument: document.document,
              readingPosition,
              status: 'available',
            }
          : item,
      ),
  };
};

export const updateSourceDocumentRevision = (
  session: DocumentSession,
  path: string,
  latestSourceDocument: SourceDocumentData,
): DocumentSession => ({
  ...session,
  activeDocumentPath:
    session.activeDocumentPath === path ? latestSourceDocument.path : session.activeDocumentPath,
  openDocuments: session.openDocuments
    .filter((item) => itemPath(item) === path || itemPath(item) !== latestSourceDocument.path)
    .map((item): OpenDocumentItem =>
      item.status === 'available' && itemPath(item) === path
        ? { ...item, latestSourceDocument }
        : item,
    ),
});

export const beginReopenRecentDocument = (
  session: DocumentSession,
  path: string,
  cachedDocument: FinishedSourceDocument | undefined,
  now: number,
): DocumentSession => {
  const recentDocument = session.recentDocuments.find((document) => document.path === path);
  if (!recentDocument) return session;

  const item: OpenDocumentItem = cachedDocument
    ? createSessionDocument(cachedDocument, now, recentDocument.readingPosition)
    : { ...recentDocument, lastOpenedAt: now, status: 'loading' };
  return {
    activeDocumentPath: path,
    openDocuments: [
      ...session.openDocuments.filter((document) => itemPath(document) !== path),
      item,
    ],
    recentDocuments: session.recentDocuments.filter((document) => document.path !== path),
  };
};

export const failLoadingDocument = (
  session: DocumentSession,
  path: string,
  message: string,
): DocumentSession => ({
  ...session,
  activeDocumentPath:
    session.activeDocumentPath === path
      ? nextAvailablePath(
          session.openDocuments.filter((item) => itemPath(item) !== path),
          0,
        )
      : session.activeDocumentPath,
  openDocuments: session.openDocuments.map((item): OpenDocumentItem =>
    item.status === 'loading' && item.path === path
      ? { ...item, message, reason: 'unreadable', status: 'unavailable' }
      : item,
  ),
});

export const recoverUnavailableDocument = (
  session: DocumentSession,
  unavailablePath: string,
  document: FinishedSourceDocument,
): DocumentSession => {
  const unavailable = session.openDocuments.find(
    (item): item is UnavailableSessionDocument =>
      item.status === 'unavailable' && item.path === unavailablePath,
  );
  if (!unavailable) {
    return session;
  }

  const openDocuments = session.openDocuments
    .filter(
      (item) => itemPath(item) === unavailablePath || itemPath(item) !== document.document.path,
    )
    .map((item): OpenDocumentItem =>
      itemPath(item) === unavailablePath
        ? createSessionDocument(document, unavailable.lastOpenedAt, unavailable.readingPosition)
        : item,
    );

  return {
    ...session,
    activeDocumentPath: session.activeDocumentPath ?? document.document.path,
    openDocuments,
    recentDocuments: session.recentDocuments.filter((item) => item.path !== document.document.path),
  };
};

export const reopenRecentDocument = (
  session: DocumentSession,
  path: string,
  result: FinishedSourceDocument | { message: string },
  now: number,
): DocumentSession => {
  const recentDocument = session.recentDocuments.find((document) => document.path === path);
  if (!recentDocument) {
    return session;
  }

  const item: OpenDocumentItem =
    'document' in result
      ? createSessionDocument(result, now, recentDocument.readingPosition)
      : {
          ...recentDocument,
          message: result.message,
          reason: 'unreadable',
          status: 'unavailable',
        };

  return {
    activeDocumentPath:
      item.status === 'available' ? item.document.path : session.activeDocumentPath,
    openDocuments: [...session.openDocuments, item],
    recentDocuments: pruneRecentDocuments(
      session.recentDocuments.filter((document) => document.path !== path),
      now,
    ),
  };
};
