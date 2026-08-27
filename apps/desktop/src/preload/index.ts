import {
  desktopIpcChannels,
  type FuxianDesktopBridge,
  type OpenSourceDocumentsResult,
} from '@fuxian/shared-types';
import { contextBridge, ipcRenderer, webUtils } from 'electron';

const bridge: FuxianDesktopBridge = Object.freeze({
  copyText: async (text: string): Promise<void> =>
    ipcRenderer.invoke(desktopIpcChannels.copyText, text),
  openDroppedSourceDocuments: async (files: File[]): Promise<OpenSourceDocumentsResult> => {
    if (!Array.isArray(files) || files.length > 100) {
      throw new TypeError('Dropped documents must be an array containing at most 100 files.');
    }

    const paths = files.map((file) => webUtils.getPathForFile(file));
    return ipcRenderer.invoke(desktopIpcChannels.openDroppedSourceDocuments, paths);
  },
  openSourceDocuments: async (): Promise<OpenSourceDocumentsResult> =>
    ipcRenderer.invoke(desktopIpcChannels.openSourceDocuments),
});

contextBridge.exposeInMainWorld('fuxian', bridge);
