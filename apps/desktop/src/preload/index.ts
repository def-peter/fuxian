import {
  desktopIpcChannels,
  type FuxianDesktopBridge,
  type OpenSourceDocumentResult,
} from '@fuxian/shared-types';
import { contextBridge, ipcRenderer } from 'electron';

const bridge: FuxianDesktopBridge = Object.freeze({
  openSourceDocument: async (): Promise<OpenSourceDocumentResult> =>
    ipcRenderer.invoke(desktopIpcChannels.openSourceDocument),
});

contextBridge.exposeInMainWorld('fuxian', bridge);
