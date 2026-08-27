import { useSyncExternalStore } from 'react';

export type ShellLayout = 'medium' | 'narrow' | 'wide';

const getShellLayout = (): ShellLayout => {
  if (globalThis.innerWidth >= 1_100) return 'wide';
  if (globalThis.innerWidth >= 840) return 'medium';
  return 'narrow';
};

const subscribe = (onStoreChange: () => void): (() => void) => {
  globalThis.addEventListener('resize', onStoreChange);
  return () => globalThis.removeEventListener('resize', onStoreChange);
};

export const useShellLayout = (): ShellLayout =>
  useSyncExternalStore(subscribe, getShellLayout, () => 'wide');
