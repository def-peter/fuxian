import {
  assertInfographicSourceSize,
  collectInfographicIllustrationNames,
  invalidInfographicSource,
  maximumInfographicSvgBytes,
  validateInfographicData,
  validateInfographicDesign,
  validateInfographicTemplate,
  validateInfographicThemeConfig,
} from './infographic-policy';
import { resolveInfographicIcon } from './infographic-icons';
import { createInfographicResourceFetch } from './infographic-resource-policy';
import { DOMParser, parseHTML } from 'linkedom/worker';

interface RenderRequest {
  id: number;
  source: string;
}

type RenderResponse =
  | { id: number; ok: true; svg: string }
  | { error: string; errorName: string; id: number; ok: false };

const immediateHandles = new Map<number, ReturnType<typeof setTimeout>>();
let immediateId = 0;
const nativeFetch = globalThis.fetch.bind(globalThis);
const onlineIllustrationQueries = new Set<string>();
const infographicResourceFetch = createInfographicResourceFetch({
  fetchNetwork: nativeFetch,
  preferOnlineResource: (query) => onlineIllustrationQueries.has(query),
  resolveLocalResource: resolveInfographicIcon,
});

Object.assign(globalThis, {
  clearImmediate: (id: number): void => {
    const handle = immediateHandles.get(id);
    if (handle !== undefined) clearTimeout(handle);
    immediateHandles.delete(id);
  },
  fetch: infographicResourceFetch,
  process: { versions: { node: 'fuxian-worker' } },
  setImmediate: (
    callback: (...arguments_: unknown[]) => void,
    ...arguments_: unknown[]
  ): number => {
    const id = ++immediateId;
    const handle = setTimeout(() => {
      immediateHandles.delete(id);
      callback(...arguments_);
    }, 0);
    immediateHandles.set(id, handle);
    return id;
  },
});

const setupOfflineDom = (): { container: Element; document: Document } => {
  const { document, window } = parseHTML(
    '<!doctype html><html><body><div id="container"></div></body></html>',
  );
  Object.assign(globalThis, { document, DOMParser, window });
  for (const name of [
    'HTMLElement',
    'HTMLDivElement',
    'HTMLSpanElement',
    'HTMLImageElement',
    'HTMLCanvasElement',
    'HTMLInputElement',
    'HTMLButtonElement',
    'Element',
    'Node',
    'Text',
    'Comment',
    'DocumentFragment',
    'Document',
    'XMLSerializer',
    'MutationObserver',
    'SVGElement',
    'SVGSVGElement',
    'SVGGraphicsElement',
    'SVGGElement',
    'SVGPathElement',
    'SVGRectElement',
    'SVGCircleElement',
    'SVGTextElement',
    'SVGLineElement',
    'SVGPolygonElement',
    'SVGPolylineElement',
    'SVGEllipseElement',
    'SVGImageElement',
    'SVGDefsElement',
    'SVGUseElement',
    'SVGClipPathElement',
    'SVGLinearGradientElement',
    'SVGRadialGradientElement',
    'SVGStopElement',
    'SVGPatternElement',
    'SVGMaskElement',
    'SVGForeignObjectElement',
    'Image',
  ]) {
    const constructor = (window as unknown as Record<string, unknown>)[name];
    if (constructor) (globalThis as unknown as Record<string, unknown>)[name] = constructor;
  }

  const canvas = document.createElement('canvas');
  const canvasPrototype = Object.getPrototypeOf(canvas) as { getContext?: unknown };
  Object.defineProperty(canvasPrototype, 'getContext', {
    configurable: true,
    value: () => null,
  });

  const fontSet = new Set<unknown>();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      add: (font: unknown) => fontSet.add(font),
      check: () => true,
      clear: () => fontSet.clear(),
      delete: (font: unknown) => fontSet.delete(font),
      entries: () => fontSet.entries(),
      forEach: (callback: (font: unknown) => void) => fontSet.forEach(callback),
      has: (font: unknown) => fontSet.has(font),
      keys: () => fontSet.keys(),
      load: () => Promise.resolve([]),
      onloading: null,
      onloadingdone: null,
      onloadingerror: null,
      ready: Promise.resolve(),
      status: 'loaded',
      values: () => fontSet.values(),
    },
  });
  Object.assign(globalThis, {
    cancelAnimationFrame: (id: number): void => {
      const handle = immediateHandles.get(id);
      if (handle !== undefined) clearTimeout(handle);
      immediateHandles.delete(id);
    },
    requestAnimationFrame: (callback: (time: number) => void): number => {
      const id = ++immediateId;
      const handle = setTimeout(() => {
        immediateHandles.delete(id);
        callback(performance.now());
      }, 0);
      immediateHandles.set(id, handle);
      return id;
    },
  });

  const container = document.getElementById('container');
  if (!container) throw new TypeError('Infographic 离线容器创建失败。');
  return { container: container as unknown as Element, document: document as unknown as Document };
};

const render = async (source: string): Promise<string> => {
  assertInfographicSourceSize(source);
  const runtime = await import('@antv/infographic');
  const { exportToSVG, getTemplates, getThemes, Infographic, parseSyntax } = runtime;
  const parsed = parseSyntax(source);
  const parseProblem = parsed.errors[0] ?? parsed.warnings[0];
  if (parseProblem) {
    throw invalidInfographicSource(`第 ${parseProblem.line} 行：${parseProblem.message}`);
  }

  const { data, design, height, template, theme, themeConfig, width } = parsed.options;
  validateInfographicTemplate(template, design, getTemplates());
  if (theme !== undefined && (typeof theme !== 'string' || !getThemes().includes(theme))) {
    throw invalidInfographicSource('必须使用名称完全匹配的官方内置主题。');
  }
  validateInfographicData(data);
  validateInfographicDesign(design);
  validateInfographicThemeConfig(themeConfig);
  onlineIllustrationQueries.clear();
  collectInfographicIllustrationNames(data).forEach((query) =>
    onlineIllustrationQueries.add(query),
  );

  const { container } = setupOfflineDom();
  const infographic = new Infographic({
    container,
    data: data!,
    editable: false,
    ...(design === undefined ? {} : { design }),
    ...(height === undefined ? {} : { height }),
    ...(template === undefined ? {} : { template }),
    ...(theme === undefined ? {} : { theme }),
    ...(themeConfig === undefined ? {} : { themeConfig }),
    ...(width === undefined ? {} : { width }),
  });
  let svg: string;
  try {
    svg = await new Promise<string>((resolve, reject) => {
      infographic.on('loaded', ({ node }) => {
        void exportToSVG(node, { embedResources: true }).then(
          (result) => resolve(result.outerHTML),
          reject,
        );
      });
      infographic.render();
    });
  } finally {
    infographic.destroy();
  }
  if (new TextEncoder().encode(svg).byteLength > maximumInfographicSvgBytes) {
    throw invalidInfographicSource(
      `渲染结果不能超过 ${maximumInfographicSvgBytes / 1024 / 1024} MB。`,
    );
  }
  return svg;
};

self.addEventListener('message', (event: MessageEvent<RenderRequest>) => {
  const { id, source } = event.data;
  void render(source).then(
    (svg) => self.postMessage({ id, ok: true, svg } satisfies RenderResponse),
    (error: unknown) =>
      self.postMessage({
        error: error instanceof Error ? error.message : 'Infographic 渲染失败。',
        errorName: error instanceof Error ? error.name : 'Error',
        id,
        ok: false,
      } satisfies RenderResponse),
  );
});
