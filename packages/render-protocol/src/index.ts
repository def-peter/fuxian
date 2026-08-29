export interface RenderTask {
  id: string;
  kind: string;
  source: string;
}

export type RenderTaskStatus = 'cancelled' | 'failed' | 'pending' | 'succeeded' | 'timed-out';

export interface RenderTaskSnapshot extends RenderTask {
  attempt: number;
  error?: string;
  status: RenderTaskStatus;
}

export interface RenderReadiness {
  cancelled: number;
  complete: boolean;
  failed: number;
  pending: number;
  succeeded: number;
  timedOut: number;
  total: number;
}

export interface RenderRevisionSnapshot {
  readiness: RenderReadiness;
  revisionId: string;
  tasks: RenderTaskSnapshot[];
}

export interface RenderTaskAdapter<Result> {
  render(task: RenderTask, signal: AbortSignal): Promise<Result>;
}

export interface RenderTaskScheduler {
  cancel(handle: unknown): void;
  schedule(callback: () => void, delayMilliseconds: number): unknown;
}

export interface RenderCoordinatorOptions<Result> {
  adapter: RenderTaskAdapter<Result>;
  onSnapshot?(snapshot: RenderRevisionSnapshot): void;
  onTaskFailure?(task: RenderTask, status: 'failed' | 'timed-out', error: string): void;
  onTaskSuccess(task: RenderTask, result: Result, signal: AbortSignal): Promise<void> | void;
  scheduler?: RenderTaskScheduler;
  timeoutMilliseconds: number;
}

export interface RenderRevisionHandle {
  cancel(): void;
  retry(taskId: string): boolean;
  snapshot(): RenderRevisionSnapshot;
  whenReady(): Promise<RenderRevisionSnapshot>;
  whenTaskKindsReady(taskKinds: readonly string[]): Promise<RenderRevisionSnapshot>;
}

interface TaskRecord extends RenderTaskSnapshot {
  abortController?: AbortController;
  runToken: number;
  timeoutHandle?: unknown;
}

interface RevisionState {
  revisionId: string;
  taskKindWaiters: Array<{
    kinds: ReadonlySet<string>;
    resolve(snapshot: RenderRevisionSnapshot): void;
  }>;
  tasks: Map<string, TaskRecord>;
  waiters: Array<(snapshot: RenderRevisionSnapshot) => void>;
}

const defaultScheduler: RenderTaskScheduler = {
  cancel: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  schedule: (callback, delayMilliseconds) => globalThis.setTimeout(callback, delayMilliseconds),
};

const errorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : '渲染任务失败。';

const createReadiness = (tasks: Iterable<TaskRecord>): RenderReadiness => {
  const readiness: RenderReadiness = {
    cancelled: 0,
    complete: true,
    failed: 0,
    pending: 0,
    succeeded: 0,
    timedOut: 0,
    total: 0,
  };

  for (const task of tasks) {
    readiness.total += 1;
    if (task.status === 'pending') readiness.pending += 1;
    if (task.status === 'succeeded') readiness.succeeded += 1;
    if (task.status === 'failed') readiness.failed += 1;
    if (task.status === 'cancelled') readiness.cancelled += 1;
    if (task.status === 'timed-out') readiness.timedOut += 1;
  }
  readiness.complete = readiness.pending === 0;
  return readiness;
};

const createSnapshot = (revision: RevisionState): RenderRevisionSnapshot => ({
  readiness: createReadiness(revision.tasks.values()),
  revisionId: revision.revisionId,
  tasks: [...revision.tasks.values()].map(({ attempt, error, id, kind, source, status }) => ({
    attempt,
    ...(error === undefined ? {} : { error }),
    id,
    kind,
    source,
    status,
  })),
});

export class RenderCoordinator<Result> {
  private currentRevision: RevisionState | undefined;
  private readonly scheduler: RenderTaskScheduler;

  constructor(private readonly options: RenderCoordinatorOptions<Result>) {
    this.scheduler = options.scheduler ?? defaultScheduler;
  }

  startRevision(revisionId: string, tasks: readonly RenderTask[]): RenderRevisionHandle {
    this.cancelRevision(this.currentRevision);

    const uniqueTasks = new Map<string, TaskRecord>();
    for (const task of tasks) {
      if (uniqueTasks.has(task.id)) {
        throw new TypeError(`Duplicate render task id: ${task.id}`);
      }
      uniqueTasks.set(task.id, {
        ...task,
        attempt: 0,
        runToken: 0,
        status: 'pending',
      });
    }

    const revision: RevisionState = {
      revisionId,
      taskKindWaiters: [],
      tasks: uniqueTasks,
      waiters: [],
    };
    this.currentRevision = revision;
    for (const task of revision.tasks.values()) {
      this.runTask(revision, task);
    }
    this.emit(revision);
    this.resolveWaiters(revision);

    return {
      cancel: () => this.cancelRevision(revision),
      retry: (taskId) => this.retryTask(revision, taskId),
      snapshot: () => createSnapshot(revision),
      whenReady: () => this.whenReady(revision),
      whenTaskKindsReady: (taskKinds) => this.whenTaskKindsReady(revision, taskKinds),
    };
  }

  private isCurrent(revision: RevisionState, task: TaskRecord, runToken: number): boolean {
    return (
      this.currentRevision === revision && task.runToken === runToken && task.status === 'pending'
    );
  }

  private clearTaskTimer(task: TaskRecord): void {
    if (task.timeoutHandle !== undefined) {
      this.scheduler.cancel(task.timeoutHandle);
      task.timeoutHandle = undefined;
    }
  }

  private runTask(revision: RevisionState, task: TaskRecord): void {
    task.abortController?.abort();
    this.clearTaskTimer(task);
    task.attempt += 1;
    delete task.error;
    task.status = 'pending';
    task.runToken += 1;
    const runToken = task.runToken;
    const abortController = new AbortController();
    task.abortController = abortController;
    task.timeoutHandle = this.scheduler.schedule(() => {
      if (!this.isCurrent(revision, task, runToken)) return;
      abortController.abort();
      task.timeoutHandle = undefined;
      task.status = 'timed-out';
      task.error = '渲染超时。';
      this.options.onTaskFailure?.(task, 'timed-out', task.error);
      this.finishTask(revision);
    }, this.options.timeoutMilliseconds);

    let execution: Promise<Result>;
    try {
      execution = this.options.adapter.render(task, abortController.signal);
    } catch (error) {
      execution = Promise.reject(error);
    }
    void execution.then(
      async (result) => {
        if (!this.isCurrent(revision, task, runToken)) return;
        try {
          await this.options.onTaskSuccess(task, result, abortController.signal);
          if (!this.isCurrent(revision, task, runToken)) return;
          this.clearTaskTimer(task);
          task.status = 'succeeded';
        } catch (error) {
          if (!this.isCurrent(revision, task, runToken)) return;
          this.clearTaskTimer(task);
          task.status = 'failed';
          task.error = errorMessage(error);
          this.options.onTaskFailure?.(task, 'failed', task.error);
        }
        this.finishTask(revision);
      },
      (error) => {
        if (!this.isCurrent(revision, task, runToken)) return;
        this.clearTaskTimer(task);
        task.status = 'failed';
        task.error = errorMessage(error);
        this.options.onTaskFailure?.(task, 'failed', task.error);
        this.finishTask(revision);
      },
    );
  }

  private finishTask(revision: RevisionState): void {
    this.emit(revision);
    this.resolveWaiters(revision);
  }

  private emit(revision: RevisionState): void {
    if (this.currentRevision === revision) {
      this.options.onSnapshot?.(createSnapshot(revision));
    }
  }

  private resolveWaiters(revision: RevisionState): void {
    const snapshot = createSnapshot(revision);
    if (snapshot.readiness.complete) {
      for (const resolve of revision.waiters.splice(0)) resolve(snapshot);
    }
    for (let index = revision.taskKindWaiters.length - 1; index >= 0; index -= 1) {
      const waiter = revision.taskKindWaiters[index];
      if (
        !waiter ||
        snapshot.tasks.some((task) => waiter.kinds.has(task.kind) && task.status === 'pending')
      ) {
        continue;
      }
      revision.taskKindWaiters.splice(index, 1);
      waiter.resolve(snapshot);
    }
  }

  private whenReady(revision: RevisionState): Promise<RenderRevisionSnapshot> {
    const snapshot = createSnapshot(revision);
    if (snapshot.readiness.complete) return Promise.resolve(snapshot);
    return new Promise((resolve) => revision.waiters.push(resolve));
  }

  private whenTaskKindsReady(
    revision: RevisionState,
    taskKinds: readonly string[],
  ): Promise<RenderRevisionSnapshot> {
    const snapshot = createSnapshot(revision);
    const kinds = new Set(taskKinds);
    if (!snapshot.tasks.some((task) => kinds.has(task.kind) && task.status === 'pending')) {
      return Promise.resolve(snapshot);
    }
    return new Promise((resolve) => revision.taskKindWaiters.push({ kinds, resolve }));
  }

  private retryTask(revision: RevisionState, taskId: string): boolean {
    const task = revision.tasks.get(taskId);
    if (this.currentRevision !== revision || !task) return false;
    this.runTask(revision, task);
    this.emit(revision);
    return true;
  }

  private cancelRevision(revision: RevisionState | undefined): void {
    if (!revision) return;
    for (const task of revision.tasks.values()) {
      if (task.status !== 'pending') continue;
      this.clearTaskTimer(task);
      task.abortController?.abort();
      task.status = 'cancelled';
    }
    this.emit(revision);
    this.resolveWaiters(revision);
  }
}
