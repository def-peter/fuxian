export const desktopIpcChannels = {
  copyText: 'fuxian:clipboard:write-text',
  loadDocumentSession: 'fuxian:document-session:load',
  locateSourceDocument: 'fuxian:source-documents:locate',
  openDroppedSourceDocuments: 'fuxian:source-documents:open-dropped',
  openSourceDocuments: 'fuxian:source-documents:open',
  retrySourceDocument: 'fuxian:source-documents:retry',
  saveDocumentSession: 'fuxian:document-session:save',
} as const;

export interface SourceDocumentData {
  name: string;
  path: string;
  resourceBaseUrl: string;
  source: string;
}

export type OpenSourceDocumentsResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'opened'; documents: SourceDocumentData[]; warnings: string[] };

export interface ReadingPosition {
  headingId?: string;
  headingOffset: number;
  relativeProgress: number;
}

export interface PersistedDocumentReference {
  lastOpenedAt: number;
  name: string;
  path: string;
  readingPosition: ReadingPosition;
}

export interface PersistedDocumentSession {
  activeDocumentPath?: string;
  openDocuments: PersistedDocumentReference[];
  recentDocuments: PersistedDocumentReference[];
  version: 1;
}

export type RestoredOpenDocument =
  | {
      document: SourceDocumentData;
      reference: PersistedDocumentReference;
      status: 'available';
    }
  | {
      message: string;
      reference: PersistedDocumentReference;
      status: 'unavailable';
    };

export interface LoadDocumentSessionResult {
  openDocuments: RestoredOpenDocument[];
  session: PersistedDocumentSession;
}

export type ReadSourceDocumentResult =
  | { document: SourceDocumentData; status: 'available' }
  | { message: string; status: 'unavailable' };

export type LocateSourceDocumentResult =
  | { status: 'cancelled' }
  | { document: SourceDocumentData; status: 'available' }
  | { message: string; status: 'unavailable' };

export interface FuxianDesktopBridge {
  copyText(text: string): Promise<void>;
  loadDocumentSession(): Promise<LoadDocumentSessionResult>;
  locateSourceDocument(path: string): Promise<LocateSourceDocumentResult>;
  openDroppedSourceDocuments(files: File[]): Promise<OpenSourceDocumentsResult>;
  openSourceDocuments(): Promise<OpenSourceDocumentsResult>;
  retrySourceDocument(path: string): Promise<ReadSourceDocumentResult>;
  saveDocumentSession(session: PersistedDocumentSession): Promise<void>;
}
