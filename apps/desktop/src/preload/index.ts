import {
  desktopIpcChannels,
  normalizeReaderPreferences,
  type ExternalRevisionEvent,
  type FuxianDesktopBridge,
  type LoadDocumentSessionResult,
  type LocateSourceDocumentResult,
  type OpenSourceDocumentsResult,
  type OpenDocumentWatchesRequest,
  type PlantUmlRenderRequest,
  type PlantUmlRenderResult,
  type PlantUmlServerValidationResult,
  type PersistedDocumentSession,
  type ReadSourceDocumentResult,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

const bridge: FuxianDesktopBridge = Object.freeze({
  cancelPlantUmlRender: (requestId: string): void =>
    ipcRenderer.send(desktopIpcChannels.cancelPlantUmlRender, requestId),
  configureOpenDocumentWatches: async (request: OpenDocumentWatchesRequest): Promise<void> =>
    ipcRenderer.invoke(desktopIpcChannels.configureOpenDocumentWatches, request),
  copyText: async (text: string): Promise<void> =>
    ipcRenderer.invoke(desktopIpcChannels.copyText, text),
  loadDocumentSession: async (): Promise<LoadDocumentSessionResult> =>
    ipcRenderer.invoke(desktopIpcChannels.loadDocumentSession),
  loadReaderPreferences: async (): Promise<ReaderPreferences> =>
    ipcRenderer.invoke(desktopIpcChannels.loadReaderPreferences),
  locateSourceDocument: async (path: string): Promise<LocateSourceDocumentResult> =>
    ipcRenderer.invoke(desktopIpcChannels.locateSourceDocument, path),
  onReaderPreferencesChanged: (
    listener: (preferences: ReaderPreferences) => void,
  ): (() => void) => {
    const handlePreferencesChanged = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      listener(normalizeReaderPreferences(value));
    };
    ipcRenderer.on(desktopIpcChannels.readerPreferencesChanged, handlePreferencesChanged);
    return () =>
      ipcRenderer.removeListener(
        desktopIpcChannels.readerPreferencesChanged,
        handlePreferencesChanged,
      );
  },
  onExternalRevision: (listener: (revision: ExternalRevisionEvent) => void): (() => void) => {
    const handleExternalRevision = (
      _event: Electron.IpcRendererEvent,
      revision: ExternalRevisionEvent,
    ): void => listener(revision);
    ipcRenderer.on(desktopIpcChannels.externalRevisionChanged, handleExternalRevision);
    return () =>
      ipcRenderer.removeListener(
        desktopIpcChannels.externalRevisionChanged,
        handleExternalRevision,
      );
  },
  openDroppedSourceDocuments: async (files: File[]): Promise<OpenSourceDocumentsResult> => {
    if (!Array.isArray(files) || files.length > 100) {
      throw new TypeError('Dropped documents must be an array containing at most 100 files.');
    }

    const paths = files.map((file) => webUtils.getPathForFile(file));
    return ipcRenderer.invoke(desktopIpcChannels.openDroppedSourceDocuments, paths);
  },
  openSettings: async (): Promise<void> => ipcRenderer.invoke(desktopIpcChannels.openSettings),
  openSourceDocuments: async (): Promise<OpenSourceDocumentsResult> =>
    ipcRenderer.invoke(desktopIpcChannels.openSourceDocuments),
  renderPlantUml: async (request: PlantUmlRenderRequest): Promise<PlantUmlRenderResult> =>
    ipcRenderer.invoke(desktopIpcChannels.renderPlantUml, request),
  retrySourceDocument: async (path: string): Promise<ReadSourceDocumentResult> =>
    ipcRenderer.invoke(desktopIpcChannels.retrySourceDocument, path),
  saveDocumentSession: async (session: PersistedDocumentSession): Promise<void> =>
    ipcRenderer.invoke(desktopIpcChannels.saveDocumentSession, session),
  saveReaderPreferences: async (preferences: ReaderPreferences): Promise<ReaderPreferences> =>
    ipcRenderer.invoke(desktopIpcChannels.saveReaderPreferences, preferences),
  validatePlantUmlServer: async (serverUrl: string): Promise<PlantUmlServerValidationResult> =>
    ipcRenderer.invoke(desktopIpcChannels.validatePlantUmlServer, serverUrl),
});

contextBridge.exposeInMainWorld('fuxian', bridge);
