import { assertVegaLiteSourceSize } from './vega-lite-policy';

export { parseVegaLiteSource } from './vega-lite-policy';

interface RenderResponse {
  error?: string;
  errorName?: string;
  id: number;
  ok: boolean;
  svg?: string;
}

interface QueuedRender {
  id: number;
  reject(reason: unknown): void;
  resolve(svg: string): void;
  signal: AbortSignal;
  source: string;
}

const abortedError = (): DOMException => new DOMException('渲染任务已取消。', 'AbortError');

const createWorker = (): Worker =>
  new Worker(new URL('./vega-lite-renderer.worker.ts', import.meta.url), {
    name: 'fuxian-vega-lite',
    type: 'module',
  });

export const createVegaLiteRenderer = (
  workerFactory: () => Worker = createWorker,
  maximumConcurrentWorkers = 2,
): ((source: string, signal: AbortSignal) => Promise<string>) => {
  const queue: QueuedRender[] = [];
  let activeWorkers = 0;
  let renderId = 0;

  const runQueuedRenders = (): void => {
    while (activeWorkers < maximumConcurrentWorkers && queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      if (job.signal.aborted) {
        job.reject(abortedError());
        continue;
      }

      activeWorkers += 1;
      let worker: Worker;
      try {
        worker = workerFactory();
      } catch (error) {
        activeWorkers -= 1;
        job.reject(error);
        continue;
      }
      let settled = false;
      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        job.signal.removeEventListener('abort', handleAbort);
        worker.terminate();
        activeWorkers -= 1;
        callback();
        runQueuedRenders();
      };
      const handleAbort = (): void => finish(() => job.reject(abortedError()));
      job.signal.addEventListener('abort', handleAbort, { once: true });
      worker.addEventListener('message', (event: MessageEvent<RenderResponse>) => {
        if (event.data.id !== job.id) return;
        finish(() => {
          if (event.data.ok && typeof event.data.svg === 'string') {
            job.resolve(event.data.svg);
            return;
          }
          const message = event.data.error || 'Vega-Lite 渲染失败。';
          job.reject(
            event.data.errorName === 'TypeError' ? new TypeError(message) : new Error(message),
          );
        });
      });
      worker.addEventListener('error', (event) => {
        finish(() => job.reject(new Error(event.message || 'Vega-Lite Worker 意外退出。')));
      });
      worker.addEventListener('messageerror', () => {
        finish(() => job.reject(new Error('Vega-Lite Worker 返回了无法读取的结果。')));
      });
      worker.postMessage({ id: job.id, source: job.source });
    }
  };

  return (source, signal) => {
    assertVegaLiteSourceSize(source);
    if (signal.aborted) return Promise.reject(abortedError());
    return new Promise<string>((resolve, reject) => {
      const job: QueuedRender = { id: ++renderId, reject, resolve, signal, source };
      const handleQueuedAbort = (): void => {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
        reject(abortedError());
      };
      signal.addEventListener('abort', handleQueuedAbort, { once: true });
      const wrappedResolve = job.resolve;
      const wrappedReject = job.reject;
      job.resolve = (svg) => {
        signal.removeEventListener('abort', handleQueuedAbort);
        wrappedResolve(svg);
      };
      job.reject = (reason) => {
        signal.removeEventListener('abort', handleQueuedAbort);
        wrappedReject(reason);
      };
      queue.push(job);
      runQueuedRenders();
    });
  };
};

export const renderVegaLite = createVegaLiteRenderer();
