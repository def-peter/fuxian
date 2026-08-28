import { describe, expect, it } from 'vitest';
import {
  RenderCoordinator,
  type RenderTask,
  type RenderTaskAdapter,
  type RenderTaskScheduler,
} from './index';

interface Deferred<Result> {
  promise: Promise<Result>;
  reject(error: unknown): void;
  resolve(result: Result): void;
}

const deferred = <Result>(): Deferred<Result> => {
  let reject!: (error: unknown) => void;
  let resolve!: (result: Result) => void;
  const promise = new Promise<Result>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

class ControlledAdapter implements RenderTaskAdapter<string> {
  readonly attempts = new Map<string, Deferred<string>[]>();

  render(task: RenderTask): Promise<string> {
    const attempt = deferred<string>();
    const attempts = this.attempts.get(task.id) ?? [];
    attempts.push(attempt);
    this.attempts.set(task.id, attempts);
    return attempt.promise;
  }

  attempt(taskId: string, index = 0): Deferred<string> {
    const attempt = this.attempts.get(taskId)?.[index];
    if (!attempt) throw new Error(`Missing attempt ${index} for ${taskId}`);
    return attempt;
  }
}

class ManualScheduler implements RenderTaskScheduler {
  private nextId = 0;
  readonly callbacks = new Map<number, () => void>();

  cancel(handle: unknown): void {
    this.callbacks.delete(handle as number);
  }

  schedule(callback: () => void): unknown {
    const id = ++this.nextId;
    this.callbacks.set(id, callback);
    return id;
  }

  fireAll(): void {
    for (const [id, callback] of [...this.callbacks]) {
      this.callbacks.delete(id);
      callback();
    }
  }
}

const task = (id: string): RenderTask => ({ id, kind: 'diagram', source: id });
const flushPromises = async (): Promise<void> => Promise.resolve();

describe('RenderCoordinator', () => {
  it('summarizes success and failure without waiting for a fixed delay', async () => {
    const adapter = new ControlledAdapter();
    const applied: string[] = [];
    const coordinator = new RenderCoordinator({
      adapter,
      onTaskSuccess: ({ id }, result) => {
        applied.push(`${id}:${result}`);
      },
      timeoutMilliseconds: 10_000,
    });
    const revision = coordinator.startRevision('revision-1', [task('math'), task('mermaid')]);
    const ready = revision.whenReady();

    adapter.attempt('math').resolve('formula');
    adapter.attempt('mermaid').reject(new Error('invalid syntax'));
    const snapshot = await ready;

    expect(snapshot.readiness).toEqual({
      cancelled: 0,
      complete: true,
      failed: 1,
      pending: 0,
      succeeded: 1,
      timedOut: 0,
      total: 2,
    });
    expect(snapshot.tasks.map(({ status }) => status)).toEqual(['succeeded', 'failed']);
    expect(applied).toEqual(['math:formula']);
  });

  it('retries a manually timed-out task through a controlled scheduler', async () => {
    const adapter = new ControlledAdapter();
    const scheduler = new ManualScheduler();
    const coordinator = new RenderCoordinator({
      adapter,
      onTaskSuccess: () => undefined,
      scheduler,
      timeoutMilliseconds: 50,
    });
    const revision = coordinator.startRevision('revision-1', [task('mermaid')]);

    scheduler.fireAll();
    expect((await revision.whenReady()).tasks[0]).toMatchObject({
      attempt: 1,
      status: 'timed-out',
    });
    expect(revision.retry('mermaid')).toBe(true);
    adapter.attempt('mermaid', 1).resolve('retried');

    expect((await revision.whenReady()).tasks[0]).toMatchObject({
      attempt: 2,
      status: 'succeeded',
    });
  });

  it('cancels obsolete work and ignores stale results from an older revision', async () => {
    const adapter = new ControlledAdapter();
    const applied: string[] = [];
    const coordinator = new RenderCoordinator({
      adapter,
      onTaskSuccess: ({ id }, result) => {
        applied.push(`${id}:${result}`);
      },
      timeoutMilliseconds: 10_000,
    });
    const oldRevision = coordinator.startRevision('old', [task('old-task')]);
    const currentRevision = coordinator.startRevision('current', [task('current-task')]);

    expect((await oldRevision.whenReady()).tasks[0]?.status).toBe('cancelled');
    adapter.attempt('old-task').resolve('stale');
    adapter.attempt('current-task').resolve('current');
    await flushPromises();

    expect((await currentRevision.whenReady()).tasks[0]?.status).toBe('succeeded');
    expect(applied).toEqual(['current-task:current']);
  });

  it('restarts pending work without applying the superseded attempt', async () => {
    const adapter = new ControlledAdapter();
    const applied: string[] = [];
    const coordinator = new RenderCoordinator({
      adapter,
      onTaskSuccess: (_task, result) => {
        applied.push(result);
      },
      timeoutMilliseconds: 10_000,
    });
    const revision = coordinator.startRevision('revision-1', [task('mermaid')]);

    expect(revision.retry('mermaid')).toBe(true);
    adapter.attempt('mermaid', 0).resolve('stale theme');
    adapter.attempt('mermaid', 1).resolve('current theme');

    expect((await revision.whenReady()).tasks[0]).toMatchObject({
      attempt: 2,
      status: 'succeeded',
    });
    expect(applied).toEqual(['current theme']);
  });

  it('keeps readiness pending until an asynchronous result is applied', async () => {
    const adapter = new ControlledAdapter();
    const application = deferred<void>();
    const coordinator = new RenderCoordinator({
      adapter,
      onTaskSuccess: () => application.promise,
      timeoutMilliseconds: 10_000,
    });
    const revision = coordinator.startRevision('revision-1', [task('async-visual')]);

    adapter.attempt('async-visual').resolve('tree');
    await flushPromises();
    expect(revision.snapshot().readiness.pending).toBe(1);

    application.resolve();
    expect((await revision.whenReady()).tasks[0]?.status).toBe('succeeded');
  });
});
