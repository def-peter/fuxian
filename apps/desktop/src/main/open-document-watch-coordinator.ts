import {
  SourceDocumentWatcher,
  type SourceDocumentWatcherOptions,
} from './source-document-watcher';

export interface OpenDocumentWatchTarget {
  path: string;
  watchedPaths: string[];
}

export interface OpenDocumentWatchCoordinatorOptions extends SourceDocumentWatcherOptions {
  inactiveDelayMilliseconds?: number;
}

interface WatchState {
  active: boolean;
  pending: boolean;
  signature: string;
  timer: ReturnType<typeof setTimeout> | undefined;
  watcher: SourceDocumentWatcher;
}

const watchedPathsSignature = (paths: readonly string[]): string =>
  [...new Set(paths)].sort().join('\n');

export class OpenDocumentWatchCoordinator {
  readonly #inactiveDelayMilliseconds: number;
  readonly #onStableChange: (path: string) => void;
  readonly #sourceWatcherOptions: SourceDocumentWatcherOptions;
  readonly #states = new Map<string, WatchState>();

  constructor(
    onStableChange: (path: string) => void,
    options: OpenDocumentWatchCoordinatorOptions = {},
  ) {
    this.#onStableChange = onStableChange;
    this.#inactiveDelayMilliseconds = options.inactiveDelayMilliseconds ?? 250;
    this.#sourceWatcherOptions = {
      ...(options.settleMilliseconds === undefined
        ? {}
        : { settleMilliseconds: options.settleMilliseconds }),
    };
  }

  configure(targets: readonly OpenDocumentWatchTarget[], activePath?: string): void {
    const targetPaths = new Set(targets.map((target) => target.path));
    for (const [path, state] of this.#states) {
      if (targetPaths.has(path)) continue;
      this.#closeState(state);
      this.#states.delete(path);
    }

    for (const target of targets) {
      const active = target.path === activePath;
      const signature = watchedPathsSignature(target.watchedPaths);
      const existing = this.#states.get(target.path);
      if (existing) {
        const priorityChanged = existing.active !== active;
        existing.active = active;
        if (existing.signature !== signature) {
          existing.signature = signature;
          existing.pending = false;
          if (existing.timer) clearTimeout(existing.timer);
          existing.timer = undefined;
          existing.watcher.configure(target.watchedPaths);
        } else if (priorityChanged && existing.pending) {
          this.#scheduleDelivery(target.path, existing);
        }
        continue;
      }

      const state: WatchState = {
        active,
        pending: false,
        signature,
        timer: undefined,
        watcher: new SourceDocumentWatcher(() => {
          state.pending = true;
          this.#scheduleDelivery(target.path, state);
        }, this.#sourceWatcherOptions),
      };
      this.#states.set(target.path, state);
      state.watcher.configure(target.watchedPaths);
    }
  }

  close(): void {
    for (const state of this.#states.values()) this.#closeState(state);
    this.#states.clear();
  }

  #closeState(state: WatchState): void {
    if (state.timer) clearTimeout(state.timer);
    state.timer = undefined;
    state.pending = false;
    state.watcher.close();
  }

  #scheduleDelivery(path: string, state: WatchState): void {
    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(
      () => {
        state.timer = undefined;
        if (!state.pending || this.#states.get(path) !== state) return;
        state.pending = false;
        this.#onStableChange(path);
      },
      state.active ? 0 : this.#inactiveDelayMilliseconds,
    );
  }
}
