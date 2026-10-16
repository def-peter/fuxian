import { watch, type FSWatcher } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export interface SourceDocumentWatcherOptions {
  settleMilliseconds?: number;
  pollingMilliseconds?: number;
}

const fingerprintPaths = async (paths: readonly string[]): Promise<string> => {
  const fingerprints = await Promise.all(
    paths.map(async (path) => {
      try {
        const details = await stat(path, { bigint: true });
        return `${path}:${details.mtimeNs}:${details.size}`;
      } catch {
        return `${path}:missing`;
      }
    }),
  );
  return fingerprints.join('|');
};

export class SourceDocumentWatcher {
  readonly #onStableChange: () => void;
  readonly #settleMilliseconds: number;
  readonly #pollingMilliseconds: number;
  #baselineFingerprint: string | undefined;
  #candidateFingerprint: string | undefined;
  #generation = 0;
  #paths: string[] = [];
  #polling = false;
  #pollTimer: ReturnType<typeof setInterval> | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #watchers: FSWatcher[] = [];

  constructor(onStableChange: () => void, options: SourceDocumentWatcherOptions = {}) {
    this.#onStableChange = onStableChange;
    this.#settleMilliseconds = options.settleMilliseconds ?? 150;
    this.#pollingMilliseconds = options.pollingMilliseconds ?? 2_000;
  }

  configure(paths: readonly string[]): void {
    this.close();
    this.#paths = [...new Set(paths.map((path) => resolve(path)))];
    const generation = this.#generation;
    this.#startWatching();
    void fingerprintPaths(this.#paths).then((fingerprint) => {
      if (generation !== this.#generation) return;
      this.#baselineFingerprint = fingerprint;
    });
    if (this.#paths.length > 0) {
      this.#pollTimer = setInterval(() => void this.#poll(), this.#pollingMilliseconds);
      this.#pollTimer.unref();
    }
  }

  #startWatching(): void {
    const pathsByDirectory = new Map<string, Set<string>>();
    for (const path of this.#paths) {
      let watchedPath = path;
      while (true) {
        const directory = dirname(watchedPath);
        if (directory === watchedPath) break;
        const watchedPaths = pathsByDirectory.get(directory) ?? new Set<string>();
        watchedPaths.add(watchedPath);
        pathsByDirectory.set(directory, watchedPaths);
        watchedPath = directory;
      }
    }

    for (const [directory, watchedPaths] of pathsByDirectory) {
      try {
        const watcher = watch(directory, (_eventType, filename) => {
          if (filename && !watchedPaths.has(resolve(directory, filename.toString()))) {
            return;
          }
          this.#scheduleProbe();
        });
        watcher.on('error', () => this.#scheduleProbe());
        this.#watchers.push(watcher);
      } catch {
        // Periodic probes still detect revisions when native watching is unavailable.
      }
    }
  }

  close(): void {
    this.#generation += 1;
    this.#baselineFingerprint = undefined;
    this.#candidateFingerprint = undefined;
    this.#paths = [];
    if (this.#pollTimer) clearInterval(this.#pollTimer);
    this.#pollTimer = undefined;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    for (const watcher of this.#watchers.splice(0)) watcher.close();
  }

  async #poll(): Promise<void> {
    if (this.#polling || this.#timer || this.#baselineFingerprint === undefined) return;
    this.#polling = true;
    const generation = this.#generation;
    try {
      const fingerprint = await fingerprintPaths(this.#paths);
      if (generation !== this.#generation || this.#timer) return;
      if (fingerprint !== this.#baselineFingerprint) this.#scheduleProbe();
    } finally {
      this.#polling = false;
    }
  }

  #scheduleProbe(): void {
    const generation = ++this.#generation;
    this.#candidateFingerprint = undefined;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#probe(generation), this.#settleMilliseconds);
  }

  async #probe(generation: number): Promise<void> {
    if (generation !== this.#generation || this.#paths.length === 0) return;
    const fingerprint = await fingerprintPaths(this.#paths);
    if (generation !== this.#generation) return;
    if (fingerprint !== this.#candidateFingerprint) {
      this.#candidateFingerprint = fingerprint;
      this.#timer = setTimeout(() => void this.#probe(generation), this.#settleMilliseconds);
      return;
    }
    this.#timer = undefined;
    this.#candidateFingerprint = undefined;
    if (fingerprint === this.#baselineFingerprint) return;
    this.#baselineFingerprint = fingerprint;
    this.#onStableChange();
  }
}
