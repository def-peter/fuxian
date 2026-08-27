import {
  desktopIpcChannels,
  normalizeReaderPreferences,
  type FuxianDesktopBridge,
  type LoadDocumentSessionResult,
  type LocateSourceDocumentResult,
  type OpenSourceDocumentsResult,
  type PersistedDocumentSession,
  type ReadSourceDocumentResult,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

const bridge: FuxianDesktopBridge = Object.freeze({
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
  retrySourceDocument: async (path: string): Promise<ReadSourceDocumentResult> =>
    ipcRenderer.invoke(desktopIpcChannels.retrySourceDocument, path),
  saveDocumentSession: async (session: PersistedDocumentSession): Promise<void> =>
    ipcRenderer.invoke(desktopIpcChannels.saveDocumentSession, session),
  saveReaderPreferences: async (preferences: ReaderPreferences): Promise<ReaderPreferences> =>
    ipcRenderer.invoke(desktopIpcChannels.saveReaderPreferences, preferences),
});

contextBridge.exposeInMainWorld('fuxian', bridge);
