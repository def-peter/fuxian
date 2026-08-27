import type {
  PersistedDocumentReference,
  PersistedDocumentSession,
  ReadingPosition,
} from '@fuxian/shared-types';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface SessionPersistence {
  load(): Promise<PersistedDocumentSession>;
  save(session: PersistedDocumentSession): Promise<void>;
}

export const createEmptyPersistedDocumentSession = (): PersistedDocumentSession => ({
  openDocuments: [],
  recentDocuments: [],
  version: 1,
});

const isReadingPosition = (value: unknown): value is ReadingPosition => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const position = value as Partial<ReadingPosition>;
  return (
    (position.headingId === undefined || typeof position.headingId === 'string') &&
    typeof position.headingOffset === 'number' &&
    Number.isFinite(position.headingOffset) &&
    typeof position.relativeProgress === 'number' &&
    Number.isFinite(position.relativeProgress) &&
    position.relativeProgress >= 0 &&
    position.relativeProgress <= 1
  );
};

const isDocumentReference = (value: unknown): value is PersistedDocumentReference => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const reference = value as Partial<PersistedDocumentReference>;
  return (
    typeof reference.name === 'string' &&
    reference.name.length > 0 &&
    typeof reference.path === 'string' &&
    reference.path.length > 0 &&
    typeof reference.lastOpenedAt === 'number' &&
    Number.isFinite(reference.lastOpenedAt) &&
    isReadingPosition(reference.readingPosition)
  );
};

export const isPersistedDocumentSession = (value: unknown): value is PersistedDocumentSession => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const session = value as Partial<PersistedDocumentSession>;
  if (
    session.version === 1 &&
    (session.activeDocumentPath === undefined || typeof session.activeDocumentPath === 'string') &&
    Array.isArray(session.openDocuments) &&
    session.openDocuments.length <= 100 &&
    session.openDocuments.every(isDocumentReference) &&
    Array.isArray(session.recentDocuments) &&
    session.recentDocuments.length <= 10 &&
    session.recentDocuments.every(isDocumentReference)
  ) {
    const openPaths = session.openDocuments.map(({ path }) => path);
    const recentPaths = session.recentDocuments.map(({ path }) => path);
    const allPaths = [...openPaths, ...recentPaths];
    return (
      new Set(allPaths).size === allPaths.length &&
      (session.activeDocumentPath === undefined || openPaths.includes(session.activeDocumentPath))
    );
  }
  return false;
};

const cloneSession = (session: PersistedDocumentSession): PersistedDocumentSession =>
  structuredClone(session);

export class MemorySessionPersistence implements SessionPersistence {
  private session: PersistedDocumentSession;

  constructor(session: PersistedDocumentSession = createEmptyPersistedDocumentSession()) {
    this.session = cloneSession(session);
  }

  async load(): Promise<PersistedDocumentSession> {
    return cloneSession(this.session);
  }

  async save(session: PersistedDocumentSession): Promise<void> {
    this.session = cloneSession(session);
  }
}

export class JsonFileSessionPersistence implements SessionPersistence {
  private pendingSave: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async load(): Promise<PersistedDocumentSession> {
    try {
      const value: unknown = JSON.parse(await readFile(this.path, 'utf8'));
      return isPersistedDocumentSession(value)
        ? cloneSession(value)
        : createEmptyPersistedDocumentSession();
    } catch {
      return createEmptyPersistedDocumentSession();
    }
  }

  async save(session: PersistedDocumentSession): Promise<void> {
    const snapshot = cloneSession(session);
    const save = async (): Promise<void> => {
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await rename(temporaryPath, this.path);
    };

    this.pendingSave = this.pendingSave.then(save, save);
    await this.pendingSave;
  }
}
