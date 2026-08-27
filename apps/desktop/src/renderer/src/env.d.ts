import type { FuxianDesktopBridge } from '@fuxian/shared-types';

declare global {
  interface Window {
    fuxian: FuxianDesktopBridge;
  }
}

export {};
