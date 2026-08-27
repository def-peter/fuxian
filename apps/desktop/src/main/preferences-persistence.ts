import {
  createDefaultReaderPreferences,
  normalizeReaderPreferences,
  type ReaderPreferences,
} from '@fuxian/shared-types';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface PreferencesPersistence {
  load(): Promise<ReaderPreferences>;
  save(preferences: ReaderPreferences): Promise<ReaderPreferences>;
}

const clonePreferences = (preferences: ReaderPreferences): ReaderPreferences =>
  structuredClone(preferences);

export class MemoryPreferencesPersistence implements PreferencesPersistence {
  private preferences: ReaderPreferences;

  constructor(preferences: ReaderPreferences = createDefaultReaderPreferences()) {
    this.preferences = clonePreferences(normalizeReaderPreferences(preferences));
  }

  async load(): Promise<ReaderPreferences> {
    return clonePreferences(this.preferences);
  }

  async save(preferences: ReaderPreferences): Promise<ReaderPreferences> {
    this.preferences = clonePreferences(normalizeReaderPreferences(preferences));
    return clonePreferences(this.preferences);
  }
}

export class JsonFilePreferencesPersistence implements PreferencesPersistence {
  private pendingSave: Promise<ReaderPreferences> = Promise.resolve(
    createDefaultReaderPreferences(),
  );

  constructor(private readonly path: string) {}

  async load(): Promise<ReaderPreferences> {
    try {
      const value: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      return normalizeReaderPreferences(value);
    } catch {
      return createDefaultReaderPreferences();
    }
  }

  async save(preferences: ReaderPreferences): Promise<ReaderPreferences> {
    const snapshot = normalizeReaderPreferences(preferences);
    const save = async (): Promise<ReaderPreferences> => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.path);
      return clonePreferences(snapshot);
    };

    this.pendingSave = this.pendingSave.then(save, save);
    return this.pendingSave;
  }
}
