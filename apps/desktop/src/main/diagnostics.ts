import log from 'electron-log/node';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PersistedDocumentSession } from '@fuxian/shared-types';

const dayMs = 86_400_000;
const logName = /^diagnostics-\d{4}-\d{2}-\d{2}(?:\.old)?\.log$/;
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ReferenceError',
  'URIError',
  'EvalError',
  'AggregateError',
]);
const errorCodes = new Set([
  'ENOENT',
  'EACCES',
  'EPERM',
  'ENOSPC',
  'EIO',
  'EBUSY',
  'EEXIST',
  'ENOTDIR',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ERR_NETWORK',
  'ERR_ABORTED',
]);

// Error messages may contain source text, URLs, credentials, or full file paths.
// Keep only known error categories and locations in our bundled application code.
export const diagnosticError = (error: unknown): Record<string, unknown> => {
  try {
    const value =
      error && typeof error === 'object'
        ? (error as { name?: unknown; code?: unknown; stack?: unknown })
        : {};
    const locations =
      typeof value.stack === 'string'
        ? [
            ...value.stack
              .slice(0, 16_384)
              .split('\n')
              .slice(1)
              .join('\n')
              .matchAll(
                /(?:out|app\.asar)[/\\](main|preload|renderer)[/\\](?:assets[/\\])?((?:index|App|SettingsApp|source-editor|finished-document)(?:-[\w-]+)?\.[cm]?js):(\d+):(\d+)/g,
              ),
          ]
            .slice(0, 8)
            .map((match) => `${match[1]}/${match[2]}:${match[3]}:${match[4]}`)
        : [];
    return {
      type: typeof value.name === 'string' && errorTypes.has(value.name) ? value.name : 'Error',
      ...(typeof value.code === 'string' && errorCodes.has(value.code) ? { code: value.code } : {}),
      ...(locations.length ? { locations } : {}),
    };
  } catch {
    return { type: 'Error' };
  }
};

export class Diagnostics {
  private readonly logger = log.create({ logId: `diagnostics-${randomUUID()}` });
  private readonly run = randomUUID();
  private key = randomBytes(32).toString('hex');
  private previousSession: { open: string[]; recent: string[]; active?: string } | undefined;
  private revision = 0;
  private enabled = false;

  constructor(
    readonly directory: string,
    private readonly environment: {
      version: string;
      platform: string;
      arch: string;
      electron: string;
      osVersion?: string;
    },
    private readonly now = Date.now,
    private readonly limits = { days: 7, bytes: 10 * 1024 * 1024, fileBytes: 1024 * 1024 },
  ) {
    this.logger.transports.console.level = false;
    this.logger.transports.file.resolvePathFn = () =>
      join(directory, `diagnostics-${this.date()}.log`);
    this.logger.transports.file.format = '{text}';
    this.logger.transports.file.maxSize = limits.fileBytes;
    this.logger.transports.file.writeOptions = { flag: 'a', encoding: 'utf8', mode: 0o600 };
    // No remote transport, console forwarding, or renderer globals are enabled.
    try {
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      const keyPath = join(directory, 'identity-key');
      try {
        const stored = readFileSync(keyPath, 'utf8');
        if (/^[a-f0-9]{64}$/.test(stored)) this.key = stored;
      } catch {
        /* A first run gets a fresh, local-only identity key. */
      }
      writeFileSync(keyPath, this.key, { mode: 0o600 });
      const interrupted = readdirSync(directory).includes('running');
      writeFileSync(join(directory, 'running'), this.run, { mode: 0o600 });
      this.enabled = true;
      this.prune();
      this.record('app.start', { ...environment, previousExitUnclean: interrupted });
    } catch {
      /* Diagnostics must never prevent the reader from starting. */
    }
  }

  private date(): string {
    return new Date(this.now()).toISOString().slice(0, 10);
  }

  documentId(path: string): string {
    return createHmac('sha256', this.key).update(path).digest('hex').slice(0, 16);
  }

  record(event: string, fields: Record<string, unknown> = {}): void {
    if (!this.enabled) return;
    try {
      this.logger.info(
        JSON.stringify({
          time: new Date(this.now()).toISOString(),
          run: this.run,
          event,
          ...fields,
        }),
      );
      this.prune();
    } catch {
      /* Logging failures must not change application control flow. */
    }
  }

  failure(event: string, error: unknown): void {
    this.record(event, { error: diagnosticError(error) });
  }

  session(
    event: 'session.loaded' | 'session.accepted',
    session: PersistedDocumentSession,
  ): { revision: number; changed: boolean } {
    const next = {
      open: session.openDocuments.map(({ path }) => this.documentId(path)),
      recent: session.recentDocuments.map(({ path }) => this.documentId(path)),
      ...(session.activeDocumentPath
        ? { active: this.documentId(session.activeDocumentPath) }
        : {}),
    };
    const previous = this.previousSession;
    const changed = JSON.stringify(next) !== JSON.stringify(previous);
    if (event === 'session.accepted') this.revision += 1;
    if (changed || event === 'session.loaded') {
      this.record(event, {
        revision: this.revision,
        openCount: next.open.length,
        recentCount: next.recent.length,
        previousOpenCount: previous?.open.length,
        ...next,
        removedOpen: previous?.open.filter((id) => !next.open.includes(id)) ?? [],
        addedOpen: next.open.filter((id) => !previous?.open.includes(id)),
      });
    }
    // Loading an older snapshot must not redefine the last accepted state.
    if (event === 'session.accepted' || !previous) this.previousSession = next;
    return { revision: this.revision, changed };
  }

  private files(): Array<{ path: string; name: string; size: number }> {
    return readdirSync(this.directory)
      .filter((name) => logName.test(name))
      .sort(
        (a, b) =>
          a.slice(12, 22).localeCompare(b.slice(12, 22)) ||
          Number(b.includes('.old.')) - Number(a.includes('.old.')),
      )
      .map((name) => ({
        name,
        path: join(this.directory, name),
        size: statSync(join(this.directory, name)).size,
      }));
  }

  prune(): void {
    if (!this.enabled) return;
    try {
      const cutoff = new Date(this.now() - (this.limits.days - 1) * dayMs)
        .toISOString()
        .slice(0, 10);
      const files = this.files();
      let bytes = files.reduce((sum, file) => sum + file.size, 0);
      for (const file of files) {
        if (file.name.slice(12, 22) < cutoff || bytes > this.limits.bytes) {
          unlinkSync(file.path);
          bytes -= file.size;
        }
      }
    } catch {
      /* A locked/missing log file should not affect the session. */
    }
  }

  exportText(): string {
    if (!this.enabled) throw new Error('Diagnostics unavailable');
    this.prune();
    const header = JSON.stringify({
      format: 'fuxian-diagnostics-v1',
      exportedAt: new Date(this.now()).toISOString(),
      ...this.environment,
    });
    return `${header}\n${this.files()
      .map(({ path }) => readFileSync(path, 'utf8'))
      .join('')}`;
  }

  clear(): void {
    if (!this.enabled) throw new Error('Diagnostics unavailable');
    for (const file of this.files()) unlinkSync(file.path);
    if (!this.logger.transports.file.getFile().clear())
      throw new Error('Could not clear diagnostics');
    this.key = randomBytes(32).toString('hex');
    writeFileSync(join(this.directory, 'identity-key'), this.key, { mode: 0o600 });
    this.previousSession = undefined;
  }

  close(): void {
    if (!this.enabled) return;
    this.record('app.exit');
    try {
      unlinkSync(join(this.directory, 'running'));
    } catch {
      /* Already removed or unavailable. */
    }
    this.enabled = false;
  }
}
