import {
  assertInfographicSourceSize,
  collectInfographicIconNames,
  invalidInfographicSource,
  isSupportedInfographicTemplate,
  maximumInfographicSvgBytes,
  validateInfographicData,
  validateInfographicThemeConfig,
} from './infographic-policy';
import { resolveInfographicIcon } from './infographic-icons';
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

Object.assign(globalThis, {
  clearImmediate: (id: number): void => {
    const handle = immediateHandles.get(id);
    if (handle !== undefined) clearTimeout(handle);
    immediateHandles.delete(id);
  },
  fetch: async (input: RequestInfo | URL): Promise<Response> => {
    const request = input instanceof Request ? input : new Request(input);
    const url = new URL(request.url);
    if (url.origin === 'https://www.weavefox.cn' && url.pathname === '/api/v1/infographic/icon') {
      const icon = await resolveInfographicIcon(url.searchParams.get('text') ?? '');
      return new Response(JSON.stringify({ data: icon ? [icon] : [], success: true }), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    }
    return new Response('', { status: 403, statusText: 'Fuxian blocks external resources' });
  },
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

  const { data, design, template, theme, themeConfig, ...unsupported } = parsed.options;
  if (Object.keys(unsupported).length > 0 || design !== undefined) {
    throw invalidInfographicSource('首版只支持官方模板、data 和有限主题配置。');
  }
  if (typeof template !== 'string' || !getTemplates().includes(template)) {
    throw invalidInfographicSource('必须使用名称完全匹配的官方内置模板。');
  }
  if (!isSupportedInfographicTemplate(template)) {
    throw invalidInfographicSource('首版不支持动画、交互、插图或词云模板。');
  }
  if (theme !== undefined && (typeof theme !== 'string' || !getThemes().includes(theme))) {
    throw invalidInfographicSource('必须使用名称完全匹配的官方内置主题。');
  }
  validateInfographicData(data);
  validateInfographicThemeConfig(themeConfig);
  for (const iconName of collectInfographicIconNames(data)) {
    if (!(await resolveInfographicIcon(iconName))) {
      throw invalidInfographicSource(`找不到本地图标 ${iconName}，请使用 lucide 或 mdi 图标名。`);
    }
  }

  const { container } = setupOfflineDom();
  const infographic = new Infographic({
    container,
    data: data!,
    editable: false,
    template,
    ...(theme === undefined ? {} : { theme }),
    ...(themeConfig === undefined ? {} : { themeConfig }),
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
