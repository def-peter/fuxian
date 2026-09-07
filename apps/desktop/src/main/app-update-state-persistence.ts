import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface AppUpdateState {
  lastNotifiedVersion?: string;
  version: 1;
}

export interface AppUpdateStatePersistence {
  load(): Promise<AppUpdateState>;
  saveLastNotifiedVersion(version: string): Promise<void>;
}

const emptyState = (): AppUpdateState => ({ version: 1 });

const normalizeVersion = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const version = value.trim();
  return version.length > 0 && version.length <= 64 ? version : undefined;
};

export const normalizeAppUpdateState = (value: unknown): AppUpdateState => {
  if (!value || typeof value !== 'object') return emptyState();
  const state = value as Partial<AppUpdateState>;
  if (state.version !== 1) return emptyState();
  const lastNotifiedVersion = normalizeVersion(state.lastNotifiedVersion);
  return lastNotifiedVersion ? { lastNotifiedVersion, version: 1 } : emptyState();
};

export class MemoryAppUpdateStatePersistence implements AppUpdateStatePersistence {
  private state: AppUpdateState;

  constructor(state: AppUpdateState = emptyState()) {
    this.state = normalizeAppUpdateState(state);
  }

  async load(): Promise<AppUpdateState> {
    return { ...this.state };
  }

  async saveLastNotifiedVersion(version: string): Promise<void> {
    this.state = normalizeAppUpdateState({ lastNotifiedVersion: version, version: 1 });
  }
}

export class JsonFileAppUpdateStatePersistence implements AppUpdateStatePersistence {
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async load(): Promise<AppUpdateState> {
    try {
      return normalizeAppUpdateState(JSON.parse(await readFile(this.path, 'utf8')));
    } catch {
      return emptyState();
    }
  }

  async saveLastNotifiedVersion(version: string): Promise<void> {
    const state = normalizeAppUpdateState({ lastNotifiedVersion: version, version: 1 });
    const save = async (): Promise<void> => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.path);
    };

    this.pendingSave = this.pendingSave.then(save, save);
    await this.pendingSave;
  }
}
