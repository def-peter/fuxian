import type { RenderTask, RenderTaskAdapter } from '@fuxian/render-protocol';
import type { FuxianDesktopBridge } from '@fuxian/shared-types';
import { renderVegaLite as defaultRenderVegaLite } from './vega-lite-renderer';

export type DocumentRenderAppearance = 'dark' | 'light';

export type DocumentRenderResult =
  | { html: string; kind: 'math' }
  | { kind: 'mermaid'; svg: string }
  | { kind: 'plantuml'; svg: string }
  | { kind: 'vega-lite'; svg: string };

export type PlantUmlRenderer = (
  source: string,
  serverUrl: string,
  signal: AbortSignal,
) => Promise<string>;

export type VegaLiteRenderer = (source: string, signal: AbortSignal) => Promise<string>;

export interface DocumentRenderAdapter extends RenderTaskAdapter<DocumentRenderResult> {
  setAppearance(appearance: DocumentRenderAppearance): void;
  setDiagramOptimization(enabled: boolean): void;
  setPlantUmlServerUrl(serverUrl: string): void;
}

export const hasExplicitDiagramStyle = (kind: string, source: string): boolean => {
  if (kind === 'plantuml') {
    return /^\s*(?:!theme\b|skinparam\b|<style>|!include\b|!define\b)/im.test(source);
  }
  return kind === 'mermaid' && /%%\{\s*(?:init|config):|"theme"\s*:|themeVariables/i.test(source);
};

export const optimizePlantUmlSource = (source: string, enabled: boolean): string => {
  if (!enabled || hasExplicitDiagramStyle('plantuml', source)) return source;
  const style = [
    'skinparam backgroundColor transparent',
    'skinparam defaultFontName sans-serif',
    'skinparam shadowing false',
  ].join('\n');
  return source.replace(/@startuml[^\n]*\n/i, (opening) => `${opening}${style}\n`);
};

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

export const createDesktopPlantUmlRenderer =
  (
    bridge: Pick<FuxianDesktopBridge, 'cancelPlantUmlRender' | 'renderPlantUml'>,
  ): PlantUmlRenderer =>
  async (source, serverUrl, signal) => {
    throwIfAborted(signal);
    const requestId = `plantuml-${Date.now()}-${++plantUmlRequestId}`;
    const cancel = (): void => bridge.cancelPlantUmlRender(requestId);
    signal.addEventListener('abort', cancel, { once: true });
    try {
      const result = await bridge.renderPlantUml({ requestId, serverUrl, source });
      throwIfAborted(signal);
      return result.svg;
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  };

export const createDocumentRenderAdapter = (
  initialAppearance: DocumentRenderAppearance,
  initialPlantUmlServerUrl: string,
  renderPlantUml: PlantUmlRenderer,
  initialDiagramOptimization = false,
  renderVegaLite: VegaLiteRenderer = defaultRenderVegaLite,
): DocumentRenderAdapter => {
  let appearance = initialAppearance;
  let optimizeDiagrams = initialDiagramOptimization;
  let plantUmlServerUrl = initialPlantUmlServerUrl;

  return {
    setAppearance: (nextAppearance) => {
      appearance = nextAppearance;
    },
    setDiagramOptimization: (enabled) => {
      optimizeDiagrams = enabled;
    },
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
            strict: 'error',
            throwOnError: true,
            trust: false,
          }),
          kind: 'math',
        };
      }

      if (task.kind === 'plantuml') {
        return {
          kind: 'plantuml',
          svg: await renderPlantUml(
            optimizePlantUmlSource(task.source, optimizeDiagrams),
            plantUmlServerUrl,
            signal,
          ),
        };
      }

      if (task.kind === 'vega-lite') {
        return { kind: 'vega-lite', svg: await renderVegaLite(task.source, signal) };
      }

      if (task.kind !== 'mermaid') throw new TypeError(`Unknown render task kind: ${task.kind}`);
      const mermaid = await loadMermaid();
      throwIfAborted(signal);
      mermaid.initialize({
        htmlLabels: false,
        securityLevel: 'strict',
        startOnLoad: false,
        suppressErrorRendering: true,
        theme:
          optimizeDiagrams && !hasExplicitDiagramStyle('mermaid', task.source)
            ? appearance === 'dark'
              ? 'dark'
              : 'neutral'
            : 'default',
      });
      const result = await mermaid.render(`fuxian-mermaid-${++mermaidRenderId}`, task.source);
      throwIfAborted(signal);
      return { kind: 'mermaid', svg: result.svg };
    },
  };
};
