import {
  createDefaultReaderPreferences,
  normalizeReaderPreferences,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { useCallback, useEffect, useRef, useState } from 'react';

export type ResolvedAppearance = 'dark' | 'light';

const getSystemAppearance = (): ResolvedAppearance =>
  globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export interface ReaderPreferencesState {
  preferences: ReaderPreferences;
  ready: boolean;
  resolvedAppearance: ResolvedAppearance;
  updatePreferences(preferences: ReaderPreferences): void;
}

export const useReaderPreferences = (): ReaderPreferencesState => {
  const [preferences, setPreferences] = useState(createDefaultReaderPreferences);
  const [ready, setReady] = useState(false);
  const [systemAppearance, setSystemAppearance] = useState(getSystemAppearance);
  const latestSave = useRef(0);
  const savePending = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = window.fuxian.onReaderPreferencesChanged((nextPreferences) => {
      if (!savePending.current) {
        setPreferences(nextPreferences);
      }
    });
    void window.fuxian
      .loadReaderPreferences()
      .then((loadedPreferences) => {
        if (!cancelled) {
          setPreferences(normalizeReaderPreferences(loadedPreferences));
        }
      })
      .catch(() => {
        // Defaults remain active when persisted preferences cannot be read.
      })
      .finally(() => {
        if (!cancelled) {
          setReady(true);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const mediaQuery = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemAppearanceChange = (): void => setSystemAppearance(getSystemAppearance());
    mediaQuery.addEventListener('change', handleSystemAppearanceChange);
    return () => mediaQuery.removeEventListener('change', handleSystemAppearanceChange);
  }, []);

  const resolvedAppearance =
    preferences.appearance === 'system' ? systemAppearance : preferences.appearance;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedAppearance === 'dark');
    document.documentElement.style.colorScheme = resolvedAppearance;
  }, [resolvedAppearance]);

  const updatePreferences = useCallback((nextPreferences: ReaderPreferences): void => {
    const normalized = normalizeReaderPreferences(nextPreferences);
    const saveVersion = latestSave.current + 1;
    latestSave.current = saveVersion;
    savePending.current = true;
    setPreferences(normalized);
    void window.fuxian
      .saveReaderPreferences(normalized)
      .then((savedPreferences) => {
        if (saveVersion === latestSave.current) {
          setPreferences(savedPreferences);
        }
      })
      .catch(() => {
        // The local preview remains usable; a later change can retry persistence.
      })
      .finally(() => {
        if (saveVersion === latestSave.current) {
          savePending.current = false;
        }
      });
  }, []);

  return { preferences, ready, resolvedAppearance, updatePreferences };
};
