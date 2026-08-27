import {
  desktopIpcChannels,
  type FuxianDesktopBridge,
  type OpenSourceDocumentResult,
} from '@fuxian/shared-types';
import { contextBridge, ipcRenderer } from 'electron';

const bridge: FuxianDesktopBridge = Object.freeze({
  copyText: async (text: string): Promise<void> =>
    ipcRenderer.invoke(desktopIpcChannels.copyText, text),
  openSourceDocument: async (): Promise<OpenSourceDocumentResult> =>
    ipcRenderer.invoke(desktopIpcChannels.openSourceDocument),
});

contextBridge.exposeInMainWorld('fuxian', bridge);
