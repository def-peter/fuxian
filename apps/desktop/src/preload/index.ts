import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('fuxian', Object.freeze({}));
