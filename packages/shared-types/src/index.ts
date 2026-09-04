export const desktopIpcChannels = {
  appCloseConfirmed: 'fuxian:app:close-confirmed',
  appCloseGuardReady: 'fuxian:app:close-guard-ready',
  appCloseRequested: 'fuxian:app:close-requested',
  appUpdateCancelDownload: 'fuxian:app-update:cancel-download',
  appUpdateCheck: 'fuxian:app-update:check',
  appUpdateDownload: 'fuxian:app-update:download',
  appUpdateGetStatus: 'fuxian:app-update:get-status',
  appUpdateInstall: 'fuxian:app-update:install',
  appUpdateOpenRelease: 'fuxian:app-update:open-release',
  appUpdateInstallPreparationFinished: 'fuxian:app-update:install-preparation-finished',
  appUpdatePrepareInstall: 'fuxian:app-update:prepare-install',
  appUpdateStatusChanged: 'fuxian:app-update:status-changed',
  cancelPlantUmlRender: 'fuxian:plantuml:cancel-render',
  cancelPdfExport: 'fuxian:pdf-export:cancel',
  copyText: 'fuxian:clipboard:write-text',
  configureOpenDocumentWatches: 'fuxian:source-documents:configure-open-watches',
  externalRevisionChanged: 'fuxian:source-documents:external-revision',
  getPdfExportPayload: 'fuxian:pdf-export:get-payload',
  getMarkdownDefaultAppStatus: 'fuxian:default-app:get-status',
  loadDocumentSession: 'fuxian:document-session:load',
  loadReaderPreferences: 'fuxian:reader-preferences:load',
  locateSourceDocument: 'fuxian:source-documents:locate',
  openDroppedSourceDocuments: 'fuxian:source-documents:open-dropped',
  openProjectHomepage: 'fuxian:project-homepage:open',
  openSettings: 'fuxian:settings:open',
  openMarkdownDefaultAppSettings: 'fuxian:default-app:open-settings',
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
  deleteSourceRecoveryDraft: 'fuxian:source-editing:delete-recovery-draft',
  loadSourceRecoveryDrafts: 'fuxian:source-editing:load-recovery-drafts',
  saveSourceDocument: 'fuxian:source-editing:save-document',
  saveSourceDocumentAs: 'fuxian:source-editing:save-document-as',
  saveSourceRecoveryDraft: 'fuxian:source-editing:save-recovery-draft',
  settingsSectionRequested: 'fuxian:settings:section-requested',
  startPdfExport: 'fuxian:pdf-export:start',
  validatePlantUmlServer: 'fuxian:plantuml:validate-server',
} as const;

export type AppUpdatePhase =
  | 'available'
  | 'checking'
  | 'downloaded'
  | 'downloading'
  | 'error'
  | 'idle'
  | 'installing'
  | 'unsupported'
  | 'up-to-date';

export type AppUpdateDelivery = 'automatic-install' | 'release-page';

export interface AppUpdateStatus {
  availableVersion?: string | undefined;
  bytesPerSecond?: number | undefined;
  checkedAt?: string | undefined;
  currentVersion: string;
  delivery: AppUpdateDelivery;
  message?: string | undefined;
  percent?: number | undefined;
  phase: AppUpdatePhase;
  releaseDate?: string | undefined;
  releaseName?: string | undefined;
  releaseNotes?: string | undefined;
  total?: number | undefined;
  transferred?: number | undefined;
}

export type SettingsSectionId = 'about' | 'appearance' | 'document' | 'general' | 'plantuml';

export const isSettingsSectionId = (value: unknown): value is SettingsSectionId =>
  value === 'about' ||
  value === 'appearance' ||
  value === 'document' ||
  value === 'general' ||
  value === 'plantuml';

export type MarkdownDefaultAppState = 'default' | 'not-default' | 'partial' | 'unavailable';

export interface MarkdownDefaultAppStatus {
  markdown: boolean | null;
  md: boolean | null;
  message?: string | undefined;
  platform: 'macos' | 'unsupported' | 'windows';
  state: MarkdownDefaultAppState;
}

export type OpenMarkdownDefaultAppSettingsResult =
  { message: string; status: 'opened' } | { message: string; status: 'unavailable' };

export interface AppUpdateInstallPreparationResult {
  message?: string | undefined;
  requestId: string;
  status: 'failed' | 'ready';
}

export const defaultPlantUmlServerUrl = 'https://www.plantuml.com/plantuml';

export const readerPreferenceLimits = {
  bodySize: { max: 22, min: 14 },
  customWidth: { max: 1200, min: 640 },
  lineHeight: { max: 2.2, min: 1.5 },
  shellRegionWidth: { max: 360, min: 176 },
} as const;

export type AppearancePreference = 'dark' | 'light' | 'system';
export type CodeHighlightTheme = 'fuxian-dark' | 'fuxian-light' | 'github-dark' | 'github-light';
export type DocumentBodyFamily = 'sans-serif' | 'serif';
export type DocumentWidthMode = 'a4' | 'adaptive' | 'custom';
export type UiLanguagePreference = 'en-US' | 'system' | 'zh-CN';
export type UiLocale = 'en-US' | 'zh-CN';

export const resolveUiLocale = (
  preference: UiLanguagePreference,
  systemLocale: unknown,
): UiLocale => {
  if (preference !== 'system') return preference;
  if (typeof systemLocale !== 'string') return 'en-US';
  const normalized = systemLocale.trim().replaceAll('_', '-').toLowerCase();
  return normalized === 'zh' || normalized.startsWith('zh-') ? 'zh-CN' : 'en-US';
};

export const isCodeHighlightTheme = (value: unknown): value is CodeHighlightTheme =>
  value === 'fuxian-dark' ||
  value === 'fuxian-light' ||
  value === 'github-dark' ||
  value === 'github-light';

export interface ReaderPreferences {
  appearance: AppearancePreference;
  codeHighlight: {
    theme: CodeHighlightTheme;
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
  language: UiLanguagePreference;
  plantUml: {
    serverUrl: string;
  };
  shell: {
    contentOutlineExpanded: boolean;
    contentOutlineWidth: number;
    documentSessionExpanded: boolean;
    documentSessionWidth: number;
  };
  version: 1;
}

export const createDefaultReaderPreferences = (): ReaderPreferences => ({
  appearance: 'system',
  codeHighlight: {
    theme: 'fuxian-light',
  },
  documentTypography: {
    bodyFamily: 'sans-serif',
    bodySize: 15,
    lineHeight: 1.85,
  },
  documentWidth: {
    customWidth: 860,
    mode: 'adaptive',
  },
  language: 'system',
  plantUml: {
    serverUrl: defaultPlantUmlServerUrl,
  },
  shell: {
    contentOutlineExpanded: true,
    contentOutlineWidth: 216,
    documentSessionExpanded: true,
    documentSessionWidth: 216,
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
    codeHighlight?: { theme?: unknown };
    documentTypography?: {
      bodyFamily?: unknown;
      bodySize?: unknown;
      lineHeight?: unknown;
    };
    documentWidth?: { customWidth?: unknown; mode?: unknown };
    language?: unknown;
    plantUml?: { serverUrl?: unknown };
    shell?: {
      contentOutlineExpanded?: unknown;
      contentOutlineWidth?: unknown;
      documentSessionExpanded?: unknown;
      documentSessionWidth?: unknown;
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
  const language =
    candidate.language === 'en-US' ||
    candidate.language === 'system' ||
    candidate.language === 'zh-CN'
      ? candidate.language
      : defaults.language;

  return {
    appearance,
    codeHighlight: {
      theme: isCodeHighlightTheme(candidate.codeHighlight?.theme)
        ? candidate.codeHighlight.theme
        : defaults.codeHighlight.theme,
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
    language,
    plantUml: {
      serverUrl:
        normalizePlantUmlServerUrl(candidate.plantUml?.serverUrl) ?? defaults.plantUml.serverUrl,
    },
    shell: {
      contentOutlineExpanded:
        typeof candidate.shell?.contentOutlineExpanded === 'boolean'
          ? candidate.shell.contentOutlineExpanded
          : defaults.shell.contentOutlineExpanded,
      contentOutlineWidth: clampPreference(
        Math.round(
          finiteNumberOr(candidate.shell?.contentOutlineWidth, defaults.shell.contentOutlineWidth),
        ),
        readerPreferenceLimits.shellRegionWidth.min,
        readerPreferenceLimits.shellRegionWidth.max,
      ),
      documentSessionExpanded:
        typeof candidate.shell?.documentSessionExpanded === 'boolean'
          ? candidate.shell.documentSessionExpanded
          : defaults.shell.documentSessionExpanded,
      documentSessionWidth: clampPreference(
        Math.round(
          finiteNumberOr(
            candidate.shell?.documentSessionWidth,
            defaults.shell.documentSessionWidth,
          ),
        ),
        readerPreferenceLimits.shellRegionWidth.min,
        readerPreferenceLimits.shellRegionWidth.max,
      ),
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

export interface SourceEditorSelection {
  anchor: number;
  head: number;
}

export interface AppCloseRequest {
  kind: 'close-window' | 'quit';
}

export interface SourceRecoveryDraft {
  baselineSource: string;
  name: string;
  path: string;
  selection: SourceEditorSelection;
  source: string;
  updatedAt: number;
  version: 1;
}

export interface SaveSourceDocumentRequest {
  expectedSource: string;
  path: string;
  source: string;
}

export type SaveSourceDocumentResult =
  | { document: SourceDocumentData; status: 'saved' }
  | { document: SourceDocumentData; status: 'conflict' }
  | { message: string; status: 'failed' };

export interface SaveSourceDocumentAsRequest {
  source: string;
  suggestedName: string;
}

export type SaveSourceDocumentAsResult =
  | { status: 'cancelled' }
  | { document: SourceDocumentData; status: 'saved' }
  | { message: string; status: 'failed' };

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
      reason: SourceDocumentUnavailableReason;
      reference: PersistedDocumentReference;
      status: 'unavailable';
    };

export interface LoadDocumentSessionResult {
  missingDocumentPaths: string[];
  openDocuments: RestoredOpenDocument[];
  session: PersistedDocumentSession;
}

export type SourceDocumentUnavailableReason = 'missing' | 'unreadable' | 'unsupported';

export type ReadSourceDocumentResult =
  | { document: SourceDocumentData; status: 'available' }
  | {
      message: string;
      reason: SourceDocumentUnavailableReason;
      status: 'unavailable';
    };

export type LocateSourceDocumentResult =
  | { status: 'cancelled' }
  | { document: SourceDocumentData; status: 'available' }
  | {
      message: string;
      reason: SourceDocumentUnavailableReason;
      status: 'unavailable';
    };

export interface StartPdfExportRequest {
  expectedPageCount?: number;
  finishedDocumentHtml: string;
  path: string;
  preferences: ReaderPreferences;
  renderedVisuals: PdfExportRenderedVisual[];
  source: string;
}

export type StartPdfExportResult =
  | { status: 'cancelled' }
  | { message: string; status: 'failed' }
  | { exportId: string; status: 'started' };

export interface PdfExportRenderedVisual {
  kind: 'infographic' | 'plantuml' | 'vega-lite';
  source: string;
  svg: string;
}

export interface PdfExportPayload {
  document: SourceDocumentData;
  expectedPageCount?: number;
  exportId: string;
  finishedDocumentHtml: string;
  preferences: ReaderPreferences;
  renderedVisuals: PdfExportRenderedVisual[];
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
  | { exportId: string; pageCount: number; status: 'ready' }
  | { exportId: string; message: string; status: 'failed' };

export interface FuxianDesktopBridge {
  cancelAppUpdateDownload(): Promise<AppUpdateStatus>;
  cancelPdfExport(exportId: string): Promise<void>;
  cancelPlantUmlRender(requestId: string): void;
  checkForAppUpdates(): Promise<AppUpdateStatus>;
  configureOpenDocumentWatches(request: OpenDocumentWatchesRequest): Promise<void>;
  copyText(text: string): Promise<void>;
  getPdfExportPayload(exportId: string): Promise<PdfExportPayload>;
  getMarkdownDefaultAppStatus(): Promise<MarkdownDefaultAppStatus>;
  getAppUpdateStatus(): Promise<AppUpdateStatus>;
  downloadAppUpdate(): Promise<AppUpdateStatus>;
  installAppUpdate(): Promise<AppUpdateStatus>;
  loadDocumentSession(): Promise<LoadDocumentSessionResult>;
  loadReaderPreferences(): Promise<ReaderPreferences>;
  loadSourceRecoveryDrafts(): Promise<SourceRecoveryDraft[]>;
  locateSourceDocument(path: string): Promise<LocateSourceDocumentResult>;
  onReaderPreferencesChanged(listener: (preferences: ReaderPreferences) => void): () => void;
  onExternalRevision(listener: (revision: ExternalRevisionEvent) => void): () => void;
  onAppCloseRequested(listener: (request: AppCloseRequest) => void): () => void;
  onAppUpdateStatusChanged(listener: (status: AppUpdateStatus) => void): () => void;
  onPdfExportProgress(listener: (progress: PdfExportProgress) => void): () => void;
  onSourceDocumentOpenRequested(listener: (result: OpenSourceDocumentsResult) => void): () => void;
  onPrepareAppUpdateInstall(listener: () => Promise<void>): () => void;
  onSettingsSectionRequested(listener: (section: SettingsSectionId) => void): () => void;
  openDroppedSourceDocuments(files: File[]): Promise<OpenSourceDocumentsResult>;
  openAppUpdateRelease(): Promise<AppUpdateStatus>;
  openProjectHomepage(): Promise<void>;
  openSettings(section?: SettingsSectionId): Promise<void>;
  openMarkdownDefaultAppSettings(): Promise<OpenMarkdownDefaultAppSettingsResult>;
  openSourceDocuments(): Promise<OpenSourceDocumentsResult>;
  renderPlantUml(request: PlantUmlRenderRequest): Promise<PlantUmlRenderResult>;
  reportPdfExportProgress(progress: PdfExportRenderProgress): void;
  retrySourceDocument(path: string): Promise<ReadSourceDocumentResult>;
  confirmAppClose(): void;
  deleteSourceRecoveryDraft(path: string): Promise<void>;
  saveDocumentSession(session: PersistedDocumentSession): Promise<void>;
  saveReaderPreferences(preferences: ReaderPreferences): Promise<ReaderPreferences>;
  saveSourceDocument(request: SaveSourceDocumentRequest): Promise<SaveSourceDocumentResult>;
  saveSourceDocumentAs(request: SaveSourceDocumentAsRequest): Promise<SaveSourceDocumentAsResult>;
  saveSourceRecoveryDraft(draft: SourceRecoveryDraft): Promise<void>;
  signalPdfExportReady(signal: PdfExportReadySignal): void;
  startPdfExport(request: StartPdfExportRequest): Promise<StartPdfExportResult>;
  validatePlantUmlServer(serverUrl: string): Promise<PlantUmlServerValidationResult>;
}
