import type { RenderTask, RenderTaskAdapter } from '@fuxian/render-protocol';
import type { FuxianDesktopBridge } from '@fuxian/shared-types';
import { renderInfographic as defaultRenderInfographic } from './infographic-renderer';
import { renderVegaLite as defaultRenderVegaLite } from './vega-lite-renderer';
import type { VegaLiteContainerSize } from './vega-lite-policy';

export type DocumentRenderResult =
  | { html: string; kind: 'math' }
  | { kind: 'infographic'; svg: string }
  | { kind: 'mermaid'; svg: string }
  | { kind: 'plantuml'; svg: string }
  | { kind: 'vega-lite'; svg: string };

export type PlantUmlRenderer = (
  source: string,
  serverUrl: string,
  signal: AbortSignal,
) => Promise<string>;

export type VegaLiteRenderer = (
  source: string,
  signal: AbortSignal,
  containerSize?: VegaLiteContainerSize,
) => Promise<string>;
export type InfographicRenderer = (source: string, signal: AbortSignal) => Promise<string>;

export interface DocumentRenderAdapter extends RenderTaskAdapter<DocumentRenderResult> {
  setPlantUmlServerUrl(serverUrl: string): void;
}

let mermaidRenderId = 0;
let katexModule: ReturnType<typeof importKatex> | undefined;
let mermaidModule: ReturnType<typeof importMermaid> | undefined;
const importKatex = () => import('katex').then((module) => module.default);
const importMermaid = () => import('mermaid').then((module) => module.default);
const loadKatex = () => (katexModule ??= importKatex());
const loadMermaid = () => (mermaidModule ??= importMermaid());

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw new DOMException('渲染任务已取消。', 'AbortError');
};

let plantUmlRequestId = 0;

interface QueuedPlantUmlRender {
  reject(reason: unknown): void;
  resolve(svg: string): void;
  serverUrl: string;
  signal: AbortSignal;
  source: string;
  queuedAbort: (() => void) | undefined;
}

const plantUmlMaximumConcurrentRequests = 2;

const createPlantUmlAbortError = (): DOMException =>
  new DOMException('渲染任务已取消。', 'AbortError');

export const createDesktopPlantUmlRenderer = (
  bridge: Pick<FuxianDesktopBridge, 'cancelPlantUmlRender' | 'renderPlantUml'>,
  maximumConcurrentRequests = plantUmlMaximumConcurrentRequests,
): PlantUmlRenderer => {
  const queue: QueuedPlantUmlRender[] = [];
  let activeRequests = 0;
  const concurrency = Math.max(1, Math.floor(maximumConcurrentRequests));

  const runQueuedRenders = (): void => {
    while (activeRequests < concurrency && queue.length > 0) {
      const job = queue.shift();
      if (!job) return;
      if (job.queuedAbort) {
        job.signal.removeEventListener('abort', job.queuedAbort);
        job.queuedAbort = undefined;
      }
      if (job.signal.aborted) {
        job.reject(createPlantUmlAbortError());
        continue;
      }

      activeRequests += 1;
      const requestId = `plantuml-${Date.now()}-${++plantUmlRequestId}`;
      let settled = false;
      const finish = (callback: () => void): void => {
        if (settled) return;
        settled = true;
        job.signal.removeEventListener('abort', handleAbort);
        activeRequests -= 1;
        callback();
        runQueuedRenders();
      };
      const handleAbort = (): void => {
        try {
          bridge.cancelPlantUmlRender(requestId);
        } finally {
          finish(() => job.reject(createPlantUmlAbortError()));
        }
      };
      job.signal.addEventListener('abort', handleAbort, { once: true });
      if (job.signal.aborted) {
        handleAbort();
        continue;
      }

      void bridge.renderPlantUml({ requestId, serverUrl: job.serverUrl, source: job.source }).then(
        (result) => finish(() => job.resolve(result.svg)),
        (error: unknown) => finish(() => job.reject(error)),
      );
    }
  };

  return (source, serverUrl, signal) => {
    throwIfAborted(signal);
    return new Promise<string>((resolve, reject) => {
      const job: QueuedPlantUmlRender = {
        queuedAbort: undefined,
        reject,
        resolve,
        serverUrl,
        signal,
        source,
      };
      const handleQueuedAbort = (): void => {
        const index = queue.indexOf(job);
        if (index < 0) return;
        queue.splice(index, 1);
        signal.removeEventListener('abort', handleQueuedAbort);
        reject(createPlantUmlAbortError());
      };
      job.queuedAbort = handleQueuedAbort;
      signal.addEventListener('abort', handleQueuedAbort, { once: true });
      queue.push(job);
      runQueuedRenders();
    });
  };
};

export const createDocumentRenderAdapter = (
  initialPlantUmlServerUrl: string,
  renderPlantUml: PlantUmlRenderer,
  renderVegaLite: VegaLiteRenderer = defaultRenderVegaLite,
  renderInfographic: InfographicRenderer = defaultRenderInfographic,
  getVegaLiteContainerSize?: (task: RenderTask) => VegaLiteContainerSize,
): DocumentRenderAdapter => {
  let plantUmlServerUrl = initialPlantUmlServerUrl;

  return {
    setPlantUmlServerUrl: (nextServerUrl) => {
      plantUmlServerUrl = nextServerUrl;
    },
    render: async (task: RenderTask, signal: AbortSignal): Promise<DocumentRenderResult> => {
      throwIfAborted(signal);
      if (task.kind === 'math-inline' || task.kind === 'math-display') {
        const katex = await loadKatex();
        throwIfAborted(signal);
        return {
          html: katex.renderToString(task.source, {
            displayMode: task.kind === 'math-display',
            output: 'mathml',
            // KaTeX can render Unicode prose in math mode; accept it without
            // rewriting authored formulas or relaxing other compatibility checks.
            strict: (code) => (code === 'unicodeTextInMathMode' ? 'ignore' : 'error'),
            throwOnError: true,
            trust: false,
          }),
          kind: 'math',
        };
      }

      if (task.kind === 'plantuml') {
        return {
          kind: 'plantuml',
          svg: await renderPlantUml(task.source, plantUmlServerUrl, signal),
        };
      }

      if (task.kind === 'vega-lite') {
        return {
          kind: 'vega-lite',
          svg: await renderVegaLite(task.source, signal, getVegaLiteContainerSize?.(task)),
        };
      }

      if (task.kind === 'infographic') {
        return { kind: 'infographic', svg: await renderInfographic(task.source, signal) };
      }

      if (task.kind !== 'mermaid') throw new TypeError(`Unknown render task kind: ${task.kind}`);
      const mermaid = await loadMermaid();
      throwIfAborted(signal);
      mermaid.initialize({
        htmlLabels: true,
        securityLevel: 'strict',
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: 'default',
      });
      const result = await mermaid.render(`fuxian-mermaid-${++mermaidRenderId}`, task.source);
      throwIfAborted(signal);
      return { kind: 'mermaid', svg: result.svg };
    },
  };
};
