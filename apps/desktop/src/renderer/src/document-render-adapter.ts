import type { RenderTask, RenderTaskAdapter } from '@fuxian/render-protocol';

export type DocumentRenderAppearance = 'dark' | 'light';

export type DocumentRenderResult =
  { html: string; kind: 'math' } | { kind: 'mermaid'; svg: string };

export interface LocalDocumentRenderAdapter extends RenderTaskAdapter<DocumentRenderResult> {
  setAppearance(appearance: DocumentRenderAppearance): void;
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

export const createLocalDocumentRenderAdapter = (
  initialAppearance: DocumentRenderAppearance,
): LocalDocumentRenderAdapter => {
  let appearance = initialAppearance;

  return {
    setAppearance: (nextAppearance) => {
      appearance = nextAppearance;
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
            strict: 'error',
            throwOnError: true,
            trust: false,
          }),
          kind: 'math',
        };
      }

      if (task.kind !== 'mermaid') throw new TypeError(`Unknown render task kind: ${task.kind}`);
      const mermaid = await loadMermaid();
      throwIfAborted(signal);
      mermaid.initialize({
        htmlLabels: false,
        securityLevel: 'strict',
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: appearance === 'dark' ? 'dark' : 'neutral',
      });
      const result = await mermaid.render(`fuxian-mermaid-${++mermaidRenderId}`, task.source);
      throwIfAborted(signal);
      return { kind: 'mermaid', svg: result.svg };
    },
  };
};
