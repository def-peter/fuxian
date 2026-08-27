export const desktopIpcChannels = {
  cancelPlantUmlRender: 'fuxian:plantuml:cancel-render',
  cancelPdfExport: 'fuxian:pdf-export:cancel',
  copyText: 'fuxian:clipboard:write-text',
  configureOpenDocumentWatches: 'fuxian:source-documents:configure-open-watches',
  externalRevisionChanged: 'fuxian:source-documents:external-revision',
  getPdfExportPayload: 'fuxian:pdf-export:get-payload',
  loadDocumentSession: 'fuxian:document-session:load',
  loadReaderPreferences: 'fuxian:reader-preferences:load',
  locateSourceDocument: 'fuxian:source-documents:locate',
  openDroppedSourceDocuments: 'fuxian:source-documents:open-dropped',
  openSettings: 'fuxian:settings:open',
  openSourceDocuments: 'fuxian:source-documents:open',
  sourceDocumentOpenRequested: 'fuxian:source-documents:open-requested',
  sourceDocumentOpenReceiverReady: 'fuxian:source-documents:open-receiver-ready',
  pdfExportProgress: 'fuxian:pdf-export:progress',
  pdfExportReady: 'fuxian:pdf-export:ready',
  reportPdfExportProgress: 'fuxian:pdf-export:report-progress',
  readerPreferencesChanged: 'fuxian:reader-preferences:changed',
  renderPlantUml: 'fuxian:plantuml:render',
  retrySourceDocument: 'fuxian:source-documents:retry',
  saveDocumentSession: 'fuxian:document-session:save',
  saveReaderPreferences: 'fuxian:reader-preferences:save',
  startPdfExport: 'fuxian:pdf-export:start',
  validatePlantUmlServer: 'fuxian:plantuml:validate-server',
} as const;

export const defaultPlantUmlServerUrl = 'https://www.plantuml.com/plantuml';

export const readerPreferenceLimits = {
  bodySize: { max: 22, min: 14 },
  customWidth: { max: 1200, min: 640 },
  lineHeight: { max: 2.2, min: 1.5 },
} as const;

export type AppearancePreference = 'dark' | 'light' | 'system';
export type DocumentBodyFamily = 'sans-serif' | 'serif';
export type DocumentWidthMode = 'a4' | 'adaptive' | 'custom';

export interface ReaderPreferences {
  appearance: AppearancePreference;
  diagram: {
    optimize: boolean;
  };
  documentTypography: {
    bodyFamily: DocumentBodyFamily;
    bodySize: number;
    lineHeight: number;
  };
  documentWidth: {
    customWidth: number;
    mode: DocumentWidthMode;
  };
  plantUml: {
    serverUrl: string;
  };
  shell: {
    contentOutlineExpanded: boolean;
    documentSessionExpanded: boolean;
  };
  version: 1;
}

export const createDefaultReaderPreferences = (): ReaderPreferences => ({
  appearance: 'system',
  diagram: {
    optimize: false,
  },
  documentTypography: {
    bodyFamily: 'serif',
    bodySize: 17,
    lineHeight: 1.85,
  },
  documentWidth: {
    customWidth: 860,
    mode: 'adaptive',
  },
  plantUml: {
    serverUrl: defaultPlantUmlServerUrl,
  },
  shell: {
    contentOutlineExpanded: true,
    documentSessionExpanded: true,
  },
  version: 1,
});

export const normalizePlantUmlServerUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || value.length > 2_048) return undefined;

  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return undefined;
    }
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.origin}${pathname}`;
  } catch {
    return undefined;
  }
};

const clampPreference = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const normalizeReaderPreferences = (value: unknown): ReaderPreferences => {
  const defaults = createDefaultReaderPreferences();
  if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1) {
    return defaults;
  }

  const candidate = value as {
    appearance?: unknown;
    diagram?: { optimize?: unknown };
    documentTypography?: {
      bodyFamily?: unknown;
      bodySize?: unknown;
      lineHeight?: unknown;
    };
    documentWidth?: { customWidth?: unknown; mode?: unknown };
    plantUml?: { serverUrl?: unknown };
    shell?: {
      contentOutlineExpanded?: unknown;
      documentSessionExpanded?: unknown;
    };
  };
  const appearance =
    candidate.appearance === 'dark' ||
    candidate.appearance === 'light' ||
    candidate.appearance === 'system'
      ? candidate.appearance
      : defaults.appearance;
  const bodyFamily =
    candidate.documentTypography?.bodyFamily === 'sans-serif' ||
    candidate.documentTypography?.bodyFamily === 'serif'
      ? candidate.documentTypography.bodyFamily
      : defaults.documentTypography.bodyFamily;
  const widthMode =
    candidate.documentWidth?.mode === 'a4' ||
    candidate.documentWidth?.mode === 'adaptive' ||
    candidate.documentWidth?.mode === 'custom'
      ? candidate.documentWidth.mode
      : defaults.documentWidth.mode;

  return {
    appearance,
    diagram: {
      optimize:
        typeof candidate.diagram?.optimize === 'boolean'
          ? candidate.diagram.optimize
          : defaults.diagram.optimize,
    },
    documentTypography: {
      bodyFamily,
      bodySize: clampPreference(
        finiteNumberOr(
          candidate.documentTypography?.bodySize,
          defaults.documentTypography.bodySize,
        ),
        readerPreferenceLimits.bodySize.min,
        readerPreferenceLimits.bodySize.max,
      ),
      lineHeight: clampPreference(
        finiteNumberOr(
          candidate.documentTypography?.lineHeight,
          defaults.documentTypography.lineHeight,
        ),
        readerPreferenceLimits.lineHeight.min,
        readerPreferenceLimits.lineHeight.max,
      ),
    },
    documentWidth: {
      customWidth: clampPreference(
        finiteNumberOr(candidate.documentWidth?.customWidth, defaults.documentWidth.customWidth),
        readerPreferenceLimits.customWidth.min,
        readerPreferenceLimits.customWidth.max,
      ),
      mode: widthMode,
    },
    plantUml: {
      serverUrl:
        normalizePlantUmlServerUrl(candidate.plantUml?.serverUrl) ?? defaults.plantUml.serverUrl,
    },
    shell: {
      contentOutlineExpanded:
        typeof candidate.shell?.contentOutlineExpanded === 'boolean'
          ? candidate.shell.contentOutlineExpanded
          : defaults.shell.contentOutlineExpanded,
      documentSessionExpanded:
        typeof candidate.shell?.documentSessionExpanded === 'boolean'
          ? candidate.shell.documentSessionExpanded
          : defaults.shell.documentSessionExpanded,
    },
    version: 1,
  };
};

export interface PlantUmlRenderRequest {
  requestId: string;
  serverUrl: string;
  source: string;
}

export interface PlantUmlRenderResult {
  svg: string;
}

export type PlantUmlServerValidationResult =
  { serverUrl: string; status: 'valid' } | { message: string; status: 'invalid' };

export interface SourceDocumentData {
  name: string;
  path: string;
  resourceBaseUrl: string;
  source: string;
}

export interface OpenDocumentWatchTarget {
  path: string;
  resourceUrls: string[];
}

export interface OpenDocumentWatchesRequest {
  activePath?: string;
  documents: OpenDocumentWatchTarget[];
}

export interface ExternalRevisionEvent {
  path: string;
  result: ReadSourceDocumentResult;
  revision: number;
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

export interface StartPdfExportRequest {
  path: string;
  preferences: ReaderPreferences;
  source: string;
}

export type StartPdfExportResult =
  | { status: 'cancelled' }
  | { message: string; status: 'failed' }
  | { exportId: string; status: 'started' };

export interface PdfExportPayload {
  document: SourceDocumentData;
  exportId: string;
  preferences: ReaderPreferences;
}

export type PdfExportProgress =
  | {
      exportId: string;
      progress: number;
      stage: 'preparing' | 'rendering' | 'saving';
      status: 'running';
    }
  | { exportId: string; outputPath: string; status: 'completed' }
  | { exportId: string; status: 'cancelled' }
  | { exportId: string; message: string; status: 'failed' };

export interface PdfExportRenderProgress {
  completed: number;
  exportId: string;
  total: number;
}

export type PdfExportReadySignal =
  { exportId: string; status: 'ready' } | { exportId: string; message: string; status: 'failed' };

export interface FuxianDesktopBridge {
  cancelPdfExport(exportId: string): Promise<void>;
  cancelPlantUmlRender(requestId: string): void;
  configureOpenDocumentWatches(request: OpenDocumentWatchesRequest): Promise<void>;
  copyText(text: string): Promise<void>;
  getPdfExportPayload(exportId: string): Promise<PdfExportPayload>;
  loadDocumentSession(): Promise<LoadDocumentSessionResult>;
  loadReaderPreferences(): Promise<ReaderPreferences>;
  locateSourceDocument(path: string): Promise<LocateSourceDocumentResult>;
  onReaderPreferencesChanged(listener: (preferences: ReaderPreferences) => void): () => void;
  onExternalRevision(listener: (revision: ExternalRevisionEvent) => void): () => void;
  onPdfExportProgress(listener: (progress: PdfExportProgress) => void): () => void;
  onSourceDocumentOpenRequested(listener: (result: OpenSourceDocumentsResult) => void): () => void;
  openDroppedSourceDocuments(files: File[]): Promise<OpenSourceDocumentsResult>;
  openSettings(): Promise<void>;
  openSourceDocuments(): Promise<OpenSourceDocumentsResult>;
  renderPlantUml(request: PlantUmlRenderRequest): Promise<PlantUmlRenderResult>;
  reportPdfExportProgress(progress: PdfExportRenderProgress): void;
  retrySourceDocument(path: string): Promise<ReadSourceDocumentResult>;
  saveDocumentSession(session: PersistedDocumentSession): Promise<void>;
  saveReaderPreferences(preferences: ReaderPreferences): Promise<ReaderPreferences>;
  signalPdfExportReady(signal: PdfExportReadySignal): void;
  startPdfExport(request: StartPdfExportRequest): Promise<StartPdfExportResult>;
  validatePlantUmlServer(serverUrl: string): Promise<PlantUmlServerValidationResult>;
}
