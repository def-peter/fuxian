import type { SourceRecoveryDraft } from '@fuxian/shared-types';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const maximumDrafts = 20;
const maximumSourceLength = 10_000_000;

interface PersistedSourceRecoveryDrafts {
  drafts: SourceRecoveryDraft[];
  version: 1;
}

export interface SourceRecoveryPersistence {
  load(): Promise<SourceRecoveryDraft[]>;
  remove(path: string): Promise<void>;
  save(draft: SourceRecoveryDraft): Promise<void>;
}

export const isSourceRecoveryDraft = (value: unknown): value is SourceRecoveryDraft => {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<SourceRecoveryDraft>;
  return (
    draft.version === 1 &&
    typeof draft.path === 'string' &&
    draft.path.length > 0 &&
    draft.path.length <= 4_096 &&
    typeof draft.name === 'string' &&
    draft.name.length > 0 &&
    draft.name.length <= 512 &&
    typeof draft.source === 'string' &&
    draft.source.length <= maximumSourceLength &&
    typeof draft.baselineSource === 'string' &&
    draft.baselineSource.length <= maximumSourceLength &&
    typeof draft.updatedAt === 'number' &&
    Number.isFinite(draft.updatedAt) &&
    Boolean(draft.selection) &&
    typeof draft.selection?.anchor === 'number' &&
    Number.isFinite(draft.selection.anchor) &&
    draft.selection.anchor >= 0 &&
    typeof draft.selection?.head === 'number' &&
    Number.isFinite(draft.selection.head) &&
    draft.selection.head >= 0
  );
};

const normalizeDrafts = (value: unknown): SourceRecoveryDraft[] => {
  if (!value || typeof value !== 'object') return [];
  const persisted = value as Partial<PersistedSourceRecoveryDrafts>;
  if (persisted.version !== 1 || !Array.isArray(persisted.drafts)) return [];
  const paths = new Set<string>();
  return persisted.drafts
    .filter(isSourceRecoveryDraft)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .filter((draft) => {
      if (paths.has(draft.path)) return false;
      paths.add(draft.path);
      return true;
    })
    .slice(0, maximumDrafts)
    .map((draft) => structuredClone(draft));
};

export class MemorySourceRecoveryPersistence implements SourceRecoveryPersistence {
  private drafts: SourceRecoveryDraft[];

  constructor(drafts: readonly SourceRecoveryDraft[] = []) {
    this.drafts = normalizeDrafts({ drafts, version: 1 });
  }

  async load(): Promise<SourceRecoveryDraft[]> {
    return structuredClone(this.drafts);
  }

  async remove(path: string): Promise<void> {
    this.drafts = this.drafts.filter((draft) => draft.path !== path);
  }

  async save(draft: SourceRecoveryDraft): Promise<void> {
    if (!isSourceRecoveryDraft(draft)) throw new TypeError('Invalid source recovery draft.');
    this.drafts = normalizeDrafts({
      drafts: [draft, ...this.drafts.filter((item) => item.path !== draft.path)],
      version: 1,
    });
  }
}

export class JsonFileSourceRecoveryPersistence implements SourceRecoveryPersistence {
  private pendingWrite: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async load(): Promise<SourceRecoveryDraft[]> {
    try {
      return normalizeDrafts(JSON.parse(await readFile(this.path, 'utf8')));
    } catch {
      return [];
    }
  }

  async remove(path: string): Promise<void> {
    await this.write((drafts) => drafts.filter((draft) => draft.path !== path));
  }

  async save(draft: SourceRecoveryDraft): Promise<void> {
    if (!isSourceRecoveryDraft(draft)) throw new TypeError('Invalid source recovery draft.');
    await this.write((drafts) => [draft, ...drafts.filter((item) => item.path !== draft.path)]);
  }

  private async write(
    update: (drafts: SourceRecoveryDraft[]) => SourceRecoveryDraft[],
  ): Promise<void> {
    const write = async (): Promise<void> => {
      const drafts = normalizeDrafts({ drafts: update(await this.load()), version: 1 });
      await mkdir(dirname(this.path), { recursive: true });
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(
        temporaryPath,
        `${JSON.stringify({ drafts, version: 1 } satisfies PersistedSourceRecoveryDrafts, null, 2)}\n`,
        'utf8',
      );
      await rename(temporaryPath, this.path);
    };
    this.pendingWrite = this.pendingWrite.then(write, write);
    await this.pendingWrite;
  }
}
