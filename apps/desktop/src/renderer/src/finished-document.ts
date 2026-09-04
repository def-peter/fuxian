import {
  documentThemeCss,
  getDocumentThemeVariables,
  type DocumentThemePreferences,
} from '@fuxian/document-theme';
import {
  RenderCoordinator,
  type RenderRevisionHandle,
  type RenderRevisionSnapshot,
  type RenderTask,
  type RenderTaskAdapter,
  type RenderTaskScheduler,
} from '@fuxian/render-protocol';
import { defaultPlantUmlServerUrl, type ReadingPosition } from '@fuxian/shared-types';
import { Code2, Maximize2 } from 'lucide-react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import createDOMPurify from 'dompurify';
import { createTranslator, type MessageKey, type Translator } from '../../localization';
import {
  createDocumentRenderAdapter,
  type DocumentRenderResult,
  type DocumentRenderAdapter,
  type PlantUmlRenderer,
  type InfographicRenderer,
  type VegaLiteRenderer,
} from './document-render-adapter';
import { captureReadingPosition, resolveReadingPosition } from './reading-position';

export interface FindResult {
  current: number;
  total: number;
}

export interface FinishedDocumentController {
  applyPlantUmlServer(serverUrl: string): void;
  applyTheme(preferences: DocumentThemePreferences): void;
  clearFind(): FindResult;
  destroy(): void;
  find(query: string): FindResult;
  findNext(): FindResult;
  findPrevious(): FindResult;
  focusRenderedVisualAction(id: string, action: 'focus' | 'source'): void;
  getRenderedVisualSnapshots(): RenderedVisualSnapshot[];
  getReadingPosition(): ReadingPosition;
  getViewportFollowState(): { distanceFromEnd: number; hasSelection: boolean };
  getRenderSnapshot(): RenderRevisionSnapshot;
  getStaticSnapshotHtml(): string;
  locateRenderedVisual(id: string): boolean;
  restoreReadingPosition(position: ReadingPosition): void;
  scrollToEnd(): ReadingPosition;
  scrollToHeading(id: string): void;
  whenRenderReady(): Promise<RenderRevisionSnapshot>;
  whenRenderTaskKindsReady(taskKinds: readonly string[]): Promise<RenderRevisionSnapshot>;
}

export interface RenderedVisualSnapshot {
  contextLabel: string;
  headingId?: string;
  headingText?: string;
  id: string;
  kind: 'infographic' | 'mermaid' | 'plantuml' | 'vega-lite';
  ordinal: number;
  source: string;
  svg?: string;
}

interface BindFinishedDocumentOptions {
  copyText(text: string): Promise<void>;
  initialPlantUmlServerUrl?: string;
  initialReadingPosition: ReadingPosition;
  onActiveHeadingChange(id: string | undefined): void;
  onFindRequest(): void;
  onFocusRenderedVisual?(visual: RenderedVisualSnapshot): void;
  onInspectRenderedVisual?(visual: RenderedVisualSnapshot): void;
  onReadingPositionChange(position: ReadingPosition): void;
  onRenderSnapshot?(snapshot: RenderRevisionSnapshot): void;
  renderAdapter?: RenderTaskAdapter<DocumentRenderResult>;
  renderInfographic?: InfographicRenderer;
  renderPlantUml?: PlantUmlRenderer;
  renderVegaLite?: VegaLiteRenderer;
  renderScheduler?: RenderTaskScheduler;
  renderTimeoutMilliseconds?: number;
  revisionId?: string;
  staticSnapshot?: boolean;
  translate?: Translator;
}

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });
let finishedDocumentRevision = 0;

const renderTaskKinds = new Set([
  'infographic',
  'math-display',
  'math-inline',
  'mermaid',
  'plantuml',
  'vega-lite',
]);
const renderedVisualTaskKinds = new Set(['infographic', 'mermaid', 'plantuml', 'vega-lite']);
const maximumRenderedVisualElements = 100_000;
const renderedVisualLabel = (kind: string): string =>
  kind === 'infographic'
    ? 'AntV Infographic'
    : kind === 'mermaid'
      ? 'Mermaid'
      : kind === 'plantuml'
        ? 'PlantUML'
        : 'Vega-Lite';
const calloutTitleKeys: Readonly<Record<string, MessageKey>> = {
  abstract: '摘要',
  bug: '缺陷',
  caution: '注意',
  danger: '危险',
  example: '示例',
  failure: '失败',
  important: '重要',
  info: '信息',
  note: '备注',
  question: '问题',
  quote: '引用',
  success: '成功',
  tip: '提示',
  todo: '待办',
  warning: '警告',
};
const resourceErrorDetailKeys: Readonly<Record<string, MessageKey>> = {
  '不支持这种图片格式。': '不支持这种图片格式。',
  '只允许访问文档目录内的相对图片。': '只允许访问文档目录内的相对图片。',
  '图片地址无效或使用了不安全的协议。': '图片地址无效或使用了不安全的协议。',
  '图片路径超出了文档的授权范围。': '图片路径超出了文档的授权范围。',
  '请确认图片存在且文件内容完整。': '请确认图片存在且文件内容完整。',
};

const allowedInfographicTextStyles = new Map<string, RegExp>([
  ['align-content', /^(?:center|flex-end|flex-start)$/u],
  ['align-items', /^(?:center|flex-end|flex-start)$/u],
  ['color', /^(?:#[0-9a-f]{3,8}|rgba?\([\d ,.]+\))$/iu],
  ['display', /^flex$/u],
  ['flex-wrap', /^(?:nowrap|wrap)$/u],
  ['font-size', /^(?:\d+(?:\.\d+)?)px$/u],
  ['font-style', /^(?:italic|normal)$/u],
  ['font-weight', /^(?:bold|normal|[1-9]00)$/u],
  ['height', /^(?:100%|\d+(?:\.\d+)?px)$/u],
  ['justify-content', /^(?:center|flex-end|flex-start)$/u],
  ['letter-spacing', /^-?\d+(?:\.\d+)?px$/u],
  ['line-height', /^\d+(?:\.\d+)?(?:px)?$/u],
  ['overflow', /^(?:hidden|visible)$/u],
  ['text-align', /^(?:center|left|right)$/u],
  ['white-space', /^(?:normal|pre-wrap)$/u],
  ['width', /^(?:100%|\d+(?:\.\d+)?px)$/u],
  ['word-break', /^(?:break-word|normal)$/u],
]);

const sanitizeInfographicText = (svg: Element, styleDocument: Document): void => {
  for (const foreignObject of svg.querySelectorAll('foreignObject')) {
    const span = foreignObject.firstElementChild as HTMLElement | null;
    if (
      foreignObject.childElementCount !== 1 ||
      span?.localName !== 'span' ||
      span.childElementCount !== 0
    ) {
      foreignObject.remove();
      continue;
    }
    for (const attribute of [...foreignObject.attributes]) {
      if (!['height', 'overflow', 'transform', 'width', 'x', 'y'].includes(attribute.name)) {
        foreignObject.removeAttribute(attribute.name);
      }
    }
    for (const attribute of [...span.attributes]) {
      if (attribute.name !== 'style' && attribute.name !== 'xmlns') {
        span.removeAttribute(attribute.name);
      }
    }
    const parsedStyle = styleDocument.createElement('span').style;
    parsedStyle.cssText = span.getAttribute('style') ?? '';
    const styleProperties = Array.from({ length: parsedStyle.length }, (_, index) =>
      parsedStyle.item(index),
    );
    for (const property of styleProperties) {
      const value = parsedStyle.getPropertyValue(property).trim();
      if (!allowedInfographicTextStyles.get(property)?.test(value)) {
        parsedStyle.removeProperty(property);
      }
    }
    if (parsedStyle.cssText) span.setAttribute('style', parsedStyle.cssText);
    else span.removeAttribute('style');
  }
};

const collectRenderTasks = (frameDocument: Document): RenderTask[] => {
  const tasks = new Map<string, RenderTask>();
  for (const element of frameDocument.querySelectorAll<HTMLElement>('[data-render-task-id]')) {
    const id = element.dataset.renderTaskId;
    const kind = element.dataset.renderTaskKind;
    const source =
      element.querySelector<HTMLElement>('.render-task-source')?.textContent ??
      element.dataset.staticRenderTaskSource;
    if (id && kind && source !== undefined && renderTaskKinds.has(kind) && !tasks.has(id)) {
      tasks.set(id, { id, kind, source });
    }
  }
  return [...tasks.values()];
};

export const prepareRenderedVisualSvg = (
  frameDocument: Document,
  source: string,
  kind: RenderTask['kind'],
  t: Translator = createTranslator('zh-CN'),
): SVGElement => {
  const template = frameDocument.createElement('template');
  template.innerHTML = source;
  const sourceSvg = template.content.firstElementChild;
  if (sourceSvg?.localName !== 'svg' || template.content.childElementCount !== 1) {
    throw new TypeError(t('图表服务没有返回有效的 SVG。'));
  }
  if (sourceSvg.querySelectorAll('*').length > maximumRenderedVisualElements) {
    throw new TypeError(t('图表包含过多 SVG 元素。'));
  }

  const frameWindow = frameDocument.defaultView;
  if (!frameWindow) throw new TypeError(t('图表所在文档尚未就绪。'));
  const purifier = createDOMPurify(frameWindow);
  if (!purifier.isSupported) throw new TypeError(t('当前环境无法安全处理 SVG。'));
  purifier.addHook('uponSanitizeAttribute', (_element, data) => {
    const name = data.attrName.toLowerCase();
    if ((name === 'href' || name.endsWith(':href')) && !data.attrValue.trim().startsWith('#')) {
      data.keepAttr = false;
    }
  });
  const fragment = purifier.sanitize(source, {
    ADD_TAGS: ['use', ...(kind === 'infographic' ? ['foreignObject', 'span'] : [])],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['image'],
    HTML_INTEGRATION_POINTS: kind === 'infographic' ? { foreignobject: true } : undefined,
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: {
      html: kind === 'infographic',
      svg: true,
      svgFilters: true,
    },
  });
  const svg = fragment.firstElementChild;
  if (svg?.localName !== 'svg' || fragment.childElementCount !== 1) {
    throw new TypeError(t('图表没有通过 SVG 安全校验。'));
  }

  if (kind === 'infographic') sanitizeInfographicText(svg, frameDocument);
  for (const anchor of svg.querySelectorAll('a')) anchor.replaceWith(...anchor.childNodes);
  return svg as SVGElement;
};

const numericSvgLength = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const match = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/u.exec(value);
  const length = match?.[1] ? Number.parseFloat(match[1]) : Number.NaN;
  return Number.isFinite(length) && length > 0 ? length : undefined;
};

const normalizePlantUmlSvgSize = (svg: SVGElement): void => {
  svg.style.removeProperty('width');
  svg.style.removeProperty('height');
  if (!svg.getAttribute('style')?.trim()) svg.removeAttribute('style');

  const viewBox = svg
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/u)
    .map(Number);
  if (
    viewBox?.length !== 4 ||
    !Number.isFinite(viewBox[2]) ||
    !Number.isFinite(viewBox[3]) ||
    viewBox[2]! <= 0 ||
    viewBox[3]! <= 0
  ) {
    return;
  }

  const ratio = viewBox[2]! / viewBox[3]!;
  const width = numericSvgLength(svg.getAttribute('width'));
  const height = numericSvgLength(svg.getAttribute('height'));
  if (!width && !height) {
    svg.setAttribute('width', `${viewBox[2]}`);
    svg.setAttribute('height', `${viewBox[3]}`);
  } else if (width && height && Math.abs(width / height - ratio) > 0.001) {
    svg.setAttribute('height', `${width / ratio}`);
  } else if (width && !height) {
    svg.setAttribute('height', `${width / ratio}`);
  } else if (!width && height) {
    svg.setAttribute('width', `${height * ratio}`);
  }
};

const normalizeVegaLiteSvgBounds = (svg: SVGSVGElement): void => {
  const viewBox = svg.viewBox.baseVal;
  if (viewBox.width <= 0 || viewBox.height <= 0) return;
  const originalViewBox = {
    height: viewBox.height,
    width: viewBox.width,
    x: viewBox.x,
    y: viewBox.y,
  };

  let contentBounds: DOMRect;
  try {
    contentBounds = svg.getBBox();
  } catch {
    return;
  }

  const overflowThreshold = 0.5;
  const safetyPadding = 2;
  const viewBoxRight = originalViewBox.x + originalViewBox.width;
  const viewBoxBottom = originalViewBox.y + originalViewBox.height;
  const contentRight = contentBounds.x + contentBounds.width;
  const contentBottom = contentBounds.y + contentBounds.height;
  const nextX =
    contentBounds.x < originalViewBox.x - overflowThreshold
      ? contentBounds.x - safetyPadding
      : originalViewBox.x;
  const nextY =
    contentBounds.y < originalViewBox.y - overflowThreshold
      ? contentBounds.y - safetyPadding
      : originalViewBox.y;
  const nextRight =
    contentRight > viewBoxRight + overflowThreshold ? contentRight + safetyPadding : viewBoxRight;
  const nextBottom =
    contentBottom > viewBoxBottom + overflowThreshold
      ? contentBottom + safetyPadding
      : viewBoxBottom;
  const nextWidth = nextRight - nextX;
  const nextHeight = nextBottom - nextY;
  if (
    nextX === originalViewBox.x &&
    nextY === originalViewBox.y &&
    nextWidth === originalViewBox.width &&
    nextHeight === originalViewBox.height
  ) {
    return;
  }

  const width = numericSvgLength(svg.getAttribute('width'));
  const height = numericSvgLength(svg.getAttribute('height'));
  svg.setAttribute('viewBox', `${nextX} ${nextY} ${nextWidth} ${nextHeight}`);
  if (width) svg.setAttribute('width', `${(width * nextWidth) / originalViewBox.width}`);
  if (height) svg.setAttribute('height', `${(height * nextHeight) / originalViewBox.height}`);
};

const conciseRenderError = (error: string, fallback: string): string => {
  const firstLine =
    error
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? fallback;
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}...` : firstLine;
};

export const applyDocumentTheme = (
  frameDocument: Document,
  preferences: DocumentThemePreferences,
): void => {
  const root = frameDocument.documentElement;
  if (!root) return;

  root.dataset.appearance = preferences.appearance;
  root.dataset.codeTheme = preferences.codeTheme;
  for (const [name, value] of Object.entries(getDocumentThemeVariables(preferences))) {
    root.style.setProperty(name, value);
  }
};

export function createFinishedDocumentSource(body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src fuxian-resource:; style-src 'unsafe-inline'" />
    <style>${documentThemeCss}</style>
  </head>
  <body>
    <main class="finished-document">${body}</main>
  </body>
</html>`;
}

export function bindFinishedDocument(
  frameDocument: Document,
  options: BindFinishedDocumentOptions,
): FinishedDocumentController {
  const t = options.translate ?? createTranslator('zh-CN');
  for (const header of frameDocument.querySelectorAll<HTMLElement>(
    '.callout-header[data-callout-default-title]',
  )) {
    const key = calloutTitleKeys[header.dataset.calloutDefaultTitle ?? ''];
    const title = header.querySelector<HTMLElement>('.callout-title');
    if (key && title) title.textContent = t(key);
  }
  for (const error of frameDocument.querySelectorAll<HTMLElement>('.resource-error')) {
    const title = error.querySelector<HTMLElement>('.resource-error-title');
    if (title) title.textContent = t('无法加载图片');
    const detail = error.querySelector<HTMLElement>('.resource-error-detail');
    const detailKey = resourceErrorDetailKeys[detail?.textContent ?? ''];
    if (detail && detailKey) detail.textContent = t(detailKey);
    const retry = error.querySelector<HTMLButtonElement>('.resource-retry-button');
    if (retry) retry.textContent = t('重试');
  }
  for (const button of frameDocument.querySelectorAll<HTMLButtonElement>('[data-copy-code]')) {
    button.ariaLabel = t('复制代码');
    button.title = t('复制代码');
    button.textContent = t('复制');
  }
  const {
    copyText,
    initialReadingPosition,
    onActiveHeadingChange,
    onFindRequest,
    onReadingPositionChange,
  } = options;
  const frameWindow = frameDocument.defaultView;
  if (!frameWindow) {
    throw new TypeError('The finished document must have an active window.');
  }

  const intersectsPagedContent = (element: Element): boolean => {
    if (!options.staticSnapshot) return true;
    const pageContent = element.closest('.pagedjs_page_content');
    if (!pageContent) return false;
    const bounds = element.getBoundingClientRect();
    const pageBounds = pageContent.getBoundingClientRect();
    return (
      bounds.width > 0 &&
      bounds.height > 0 &&
      bounds.right > pageBounds.left &&
      bounds.left < pageBounds.right &&
      bounds.bottom > pageBounds.top &&
      bounds.top < pageBounds.bottom
    );
  };
  const headingElements = Array.from(
    frameDocument.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'),
  ).filter(
    (heading) =>
      !heading.matches('.sr-only') &&
      !heading.closest('[hidden]') &&
      intersectsPagedContent(heading),
  );
  const findRanges: Range[] = [];
  let currentFindIndex = -1;
  let scrollAnimationFrame = 0;
  let scrollIdleTimer = 0;
  let restoreAnimationFrame = 0;
  let restoringReadingPosition = true;
  const allRenderTasks = collectRenderTasks(frameDocument);
  const documentRenderAdapter: DocumentRenderAdapter | undefined =
    options.staticSnapshot || options.renderAdapter
      ? undefined
      : createDocumentRenderAdapter(
          options.initialPlantUmlServerUrl ?? defaultPlantUmlServerUrl,
          options.renderPlantUml ??
            (async () => {
              throw new TypeError(t('PlantUML 渲染服务不可用。'));
            }),
          options.renderVegaLite,
          options.renderInfographic,
        );
  const renderTaskList = options.staticSnapshot ? [] : allRenderTasks;
  const renderTasks = new Map(allRenderTasks.map((task) => [task.id, task]));
  const renderTaskElements = new Map<string, HTMLElement>();
  for (const element of frameDocument.querySelectorAll<HTMLElement>('[data-render-task-id]')) {
    const id = element.dataset.renderTaskId;
    if (!id) continue;
    const current = renderTaskElements.get(id);
    if (!current || element.querySelector('.render-task-output svg')) {
      renderTaskElements.set(id, element);
    }
  }
  const getRenderTaskElement = (task: RenderTask): HTMLElement | undefined =>
    renderTaskElements.get(task.id);
  const diagramContexts = new Map(
    allRenderTasks
      .filter((task) => renderedVisualTaskKinds.has(task.kind))
      .flatMap((task, index) => {
        const element = getRenderTaskElement(task);
        if (!element) return [];
        const heading = headingElements.findLast((candidate) =>
          Boolean(candidate.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
        );
        const headingText = heading?.textContent?.trim();
        const ordinal = index + 1;
        return [
          [
            task.id,
            {
              contextLabel: headingText
                ? t('{heading} · 图表 {ordinal}', { heading: headingText, ordinal })
                : t('文档开头 · 图表 {ordinal}', { ordinal }),
              ...(heading ? { headingId: heading.id } : {}),
              ...(headingText ? { headingText } : {}),
              ordinal,
            },
          ] as const,
        ];
      }),
  );
  const getRenderedVisualSnapshot = (task: RenderTask): RenderedVisualSnapshot | undefined => {
    if (!renderedVisualTaskKinds.has(task.kind)) return undefined;
    const element = getRenderTaskElement(task);
    const context = diagramContexts.get(task.id);
    if (!element || !context) return undefined;
    const svg = element.querySelector('.render-task-output svg')?.outerHTML;
    return {
      ...context,
      id: task.id,
      kind: task.kind as RenderedVisualSnapshot['kind'],
      source: task.source,
      ...(svg ? { svg } : {}),
    };
  };

  const getViewportFollowState = (): { distanceFromEnd: number; hasSelection: boolean } => {
    const scrollHeight = Math.max(
      frameDocument.documentElement.scrollHeight,
      frameDocument.body?.scrollHeight ?? 0,
    );
    const selection = frameWindow.getSelection();
    return {
      distanceFromEnd: Math.max(0, scrollHeight - (frameWindow.scrollY + frameWindow.innerHeight)),
      hasSelection: Boolean(selection && !selection.isCollapsed && selection.toString()),
    };
  };

  const createDiagramAction = (
    action: 'fit' | 'focus' | 'source' | 'zoom-in' | 'zoom-out',
    label: string,
    icon: typeof Code2,
  ): HTMLButtonElement => {
    const button = frameDocument.createElement('button');
    button.ariaLabel = label;
    button.className = 'diagram-action-button';
    button.dataset.diagramAction = action;
    button.dataset.tooltip = label;
    button.disabled = action === 'focus';
    button.title = label;
    button.type = 'button';
    button.innerHTML = renderToStaticMarkup(createElement(icon, { 'aria-hidden': true }));
    return button;
  };

  for (const task of allRenderTasks) {
    if (!renderedVisualTaskKinds.has(task.kind)) continue;
    const element = getRenderTaskElement(task);
    if (!element) continue;
    const errorTitle = element.querySelector<HTMLElement>('.render-task-error-title');
    if (errorTitle) {
      errorTitle.textContent = t(
        task.kind === 'infographic'
          ? '无法呈现信息图'
          : renderedVisualTaskKinds.has(task.kind)
            ? '无法呈现图表'
            : '无法呈现公式',
      );
    }
    const retryButton = element.querySelector<HTMLButtonElement>('.render-task-retry-button');
    if (retryButton) retryButton.textContent = t('重试');
    const visual = getRenderedVisualSnapshot(task);
    if (visual) {
      element.ariaLabel = t('{kind} 图表 {ordinal}，{heading}', {
        heading: visual.headingText || t('文档开头'),
        kind: renderedVisualLabel(task.kind),
        ordinal: visual.ordinal,
      });
      element.tabIndex = -1;
    }
    const toolbar = frameDocument.createElement('span');
    toolbar.ariaLabel = t('图表操作');
    toolbar.className = 'diagram-action-toolbar';
    toolbar.role = 'toolbar';
    toolbar.append(
      createDiagramAction('source', t('查看图表源码'), Code2),
      createDiagramAction('focus', t('全屏查看图表'), Maximize2),
    );
    element.prepend(toolbar);
  }

  const setRenderTaskPending = (task: RenderTask, attempt: number): void => {
    const element = getRenderTaskElement(task);
    if (!element) return;
    element.dataset.renderState = 'pending';
    element.setAttribute('aria-busy', 'true');
    element.dataset.renderAttempt = `${attempt}`;
    const source = element.querySelector<HTMLElement>('.render-task-source');
    const skeleton = element.querySelector<HTMLElement>('.render-task-skeleton');
    const output = element.querySelector<HTMLElement>('.render-task-output');
    const error = element.querySelector<HTMLElement>('.render-task-error');
    const hasSnapshot = Boolean(output?.querySelector('svg'));
    if (source) source.hidden = renderedVisualTaskKinds.has(task.kind);
    if (skeleton) skeleton.hidden = hasSnapshot;
    if (output) output.hidden = !hasSnapshot;
    if (error) error.hidden = true;
  };

  const applyRenderResult = async (
    task: RenderTask,
    result: DocumentRenderResult,
  ): Promise<void> => {
    const element = getRenderTaskElement(task);
    const output = element?.querySelector<HTMLElement>('.render-task-output');
    if (!element || !output) throw new TypeError(t('渲染任务占位已不存在。'));
    element.setAttribute('aria-busy', 'false');
    if (result.kind === 'math') {
      output.innerHTML = result.html;
    } else {
      const svg = prepareRenderedVisualSvg(frameDocument, result.svg, task.kind, t);
      if (task.kind === 'plantuml') normalizePlantUmlSvgSize(svg);
      output.hidden = false;
      output.replaceChildren(svg);
      if (task.kind === 'vega-lite') normalizeVegaLiteSvgBounds(svg as SVGSVGElement);
    }
    element.querySelector<HTMLElement>('.render-task-source')?.setAttribute('hidden', '');
    element.querySelector<HTMLElement>('.render-task-skeleton')?.setAttribute('hidden', '');
    element.querySelector<HTMLElement>('.render-task-error')?.setAttribute('hidden', '');
    const focusButton = element.querySelector<HTMLButtonElement>('[data-diagram-action="focus"]');
    if (focusButton) focusButton.disabled = false;
    output.hidden = false;
  };

  const applyRenderFailure = (
    task: RenderTask,
    status: 'failed' | 'timed-out',
    error: string,
  ): void => {
    const element = getRenderTaskElement(task);
    if (!element) return;
    element.dataset.renderState = status;
    element.setAttribute('aria-busy', 'false');
    const detail = element.querySelector<HTMLElement>('[data-render-error-detail]');
    if (detail) {
      const fallback = t('渲染任务失败。');
      const conciseError = conciseRenderError(error, fallback);
      detail.textContent =
        status === 'timed-out'
          ? t('渲染超时，请重试。')
          : fallback !== '渲染任务失败。' && /\p{Script=Han}/u.test(conciseError)
            ? fallback
            : conciseError;
    }
    element.querySelector<HTMLElement>('.render-task-source')?.setAttribute('hidden', '');
    element.querySelector<HTMLElement>('.render-task-skeleton')?.setAttribute('hidden', '');
    const output = element.querySelector<HTMLElement>('.render-task-output');
    if (output && !output.querySelector('svg')) output.hidden = true;
    const errorElement = element.querySelector<HTMLElement>('.render-task-error');
    if (errorElement) errorElement.hidden = false;
  };

  const renderCoordinator = new RenderCoordinator<DocumentRenderResult>({
    adapter:
      options.renderAdapter ??
      documentRenderAdapter ??
      ({
        render: async () => {
          throw new TypeError(t('静态文档快照不执行渲染任务。'));
        },
      } satisfies RenderTaskAdapter<DocumentRenderResult>),
    onSnapshot: (snapshot) => {
      frameDocument.documentElement.dataset.renderReadiness = snapshot.readiness.complete
        ? 'ready'
        : 'pending';
      frameDocument.documentElement.dataset.renderPendingTasks = `${snapshot.readiness.pending}`;
      for (const task of snapshot.tasks) {
        if (task.status === 'pending') {
          const element = getRenderTaskElement(task);
          if (element?.dataset.renderAttempt !== `${task.attempt}`) {
            setRenderTaskPending(task, task.attempt);
          }
        }
        if (task.status === 'succeeded') {
          const element = getRenderTaskElement(task);
          if (element) element.dataset.renderState = 'succeeded';
        }
      }
      frameWindow.dispatchEvent(
        new frameWindow.CustomEvent('fuxian-render-readiness', { detail: snapshot }),
      );
      options.onRenderSnapshot?.(snapshot);
    },
    onTaskFailure: applyRenderFailure,
    onTaskSuccess: applyRenderResult,
    ...(options.renderScheduler ? { scheduler: options.renderScheduler } : {}),
    timeoutMilliseconds: options.renderTimeoutMilliseconds ?? 15_000,
  });
  const renderRevision: RenderRevisionHandle = renderCoordinator.startRevision(
    options.revisionId ?? `finished-document-${++finishedDocumentRevision}`,
    renderTaskList,
  );

  const getHeadingOffsets = () =>
    headingElements.map((heading) => ({
      id: heading.id,
      top: frameWindow.scrollY + heading.getBoundingClientRect().top,
    }));

  const getMaxScroll = (): number =>
    Math.max(0, frameDocument.documentElement.scrollHeight - frameWindow.innerHeight);

  const getReadingPosition = (): ReadingPosition =>
    captureReadingPosition(frameWindow.scrollY, getMaxScroll(), getHeadingOffsets());

  const restoreReadingPosition = (position: ReadingPosition): void => {
    frameWindow.scrollTo({
      top: resolveReadingPosition(position, getMaxScroll(), getHeadingOffsets()),
    });
  };

  const setImageErrorVisible = (image: HTMLImageElement, visible: boolean): void => {
    const error = image.closest('.document-image')?.querySelector<HTMLElement>('.resource-error');
    image.hidden = visible;
    if (error) {
      error.hidden = !visible;
    }
  };

  const updateActiveHeading = (): void => {
    scrollAnimationFrame = 0;
    if (headingElements.length === 0) {
      onActiveHeadingChange(undefined);
      return;
    }

    const activationLine = Math.min(140, frameWindow.innerHeight * 0.25);
    let activeHeading = headingElements.at(-1);
    if (frameWindow.scrollY < getMaxScroll() - 1) {
      activeHeading = headingElements[0];
      for (const heading of headingElements) {
        if (heading.getBoundingClientRect().top > activationLine) {
          break;
        }
        activeHeading = heading;
      }
    }

    onActiveHeadingChange(activeHeading?.id);
    if (!restoringReadingPosition) {
      onReadingPositionChange(getReadingPosition());
    }
  };

  const scheduleActiveHeadingUpdate = (): void => {
    if (!scrollAnimationFrame) {
      scrollAnimationFrame = frameWindow.requestAnimationFrame(updateActiveHeading);
    }
  };

  const handleViewportScroll = (): void => {
    frameDocument.documentElement.dataset.scrollActive = 'true';
    if (scrollIdleTimer) window.clearTimeout(scrollIdleTimer);
    scrollIdleTimer = window.setTimeout(() => {
      scrollIdleTimer = 0;
      delete frameDocument.documentElement.dataset.scrollActive;
    }, 700);
    scheduleActiveHeadingUpdate();
  };

  const clearFindHighlights = (): FindResult => {
    frameWindow.CSS?.highlights?.delete('fuxian-find-results');
    frameWindow.CSS?.highlights?.delete('fuxian-find-current');
    findRanges.length = 0;
    currentFindIndex = -1;
    return emptyFindResult();
  };

  const activateFindRange = (index: number): FindResult => {
    if (findRanges.length === 0) {
      return emptyFindResult();
    }

    currentFindIndex = (index + findRanges.length) % findRanges.length;
    const currentRange = findRanges[currentFindIndex];
    if (!currentRange) {
      return emptyFindResult();
    }

    const HighlightConstructor = Reflect.get(frameWindow, 'Highlight') as typeof Highlight;
    frameWindow.CSS.highlights.set('fuxian-find-current', new HighlightConstructor(currentRange));

    const matchRect = currentRange.getBoundingClientRect();
    frameWindow.scrollTo({
      behavior: 'smooth',
      top: Math.max(0, frameWindow.scrollY + matchRect.top - frameWindow.innerHeight * 0.3),
    });

    return { current: currentFindIndex + 1, total: findRanges.length };
  };

  const find = (query: string): FindResult => {
    clearFindHighlights();
    if (!query) {
      return emptyFindResult();
    }

    const normalizedQuery = query.toLocaleLowerCase();
    const findRoot = options.staticSnapshot
      ? frameDocument.querySelector('.paper-preview-pages')
      : frameDocument.querySelector('.finished-document');
    const walker = frameDocument.createTreeWalker(
      findRoot ?? frameDocument.body,
      NodeFilter.SHOW_TEXT,
    );

    let textNode = walker.nextNode();
    while (textNode) {
      const parent = textNode.parentElement;
      const value = textNode.nodeValue ?? '';
      if (parent && !parent.closest('[hidden], .sr-only') && value) {
        const normalizedValue = value.toLocaleLowerCase();
        let matchIndex = normalizedValue.indexOf(normalizedQuery);
        while (matchIndex !== -1) {
          const range = frameDocument.createRange();
          range.setStart(textNode, matchIndex);
          range.setEnd(textNode, matchIndex + query.length);
          findRanges.push(range);
          matchIndex = normalizedValue.indexOf(normalizedQuery, matchIndex + query.length);
        }
      }
      textNode = walker.nextNode();
    }

    if (findRanges.length === 0) {
      return emptyFindResult();
    }

    const HighlightConstructor = Reflect.get(frameWindow, 'Highlight') as typeof Highlight;
    frameWindow.CSS.highlights.set('fuxian-find-results', new HighlightConstructor(...findRanges));
    return activateFindRange(0);
  };

  const handleFinishedDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const diagramAction = target?.closest<HTMLButtonElement>('[data-diagram-action]');
    if (diagramAction) {
      const id = diagramAction.closest<HTMLElement>('[data-render-task-id]')?.dataset.renderTaskId;
      const task = id ? renderTasks.get(id) : undefined;
      if (!task || !renderedVisualTaskKinds.has(task.kind)) return;
      const visual = getRenderedVisualSnapshot(task);
      if (!visual) return;
      if (diagramAction.dataset.diagramAction === 'source')
        options.onInspectRenderedVisual?.(visual);
      if (diagramAction.dataset.diagramAction === 'focus' && visual.svg)
        options.onFocusRenderedVisual?.(visual);
      return;
    }
    const renderRetryButton = target?.closest<HTMLButtonElement>('[data-retry-render-task]');
    if (renderRetryButton) {
      const id =
        renderRetryButton.closest<HTMLElement>('[data-render-task-id]')?.dataset.renderTaskId;
      if (id) renderRevision.retry(id);
      return;
    }
    const retryButton = target?.closest<HTMLButtonElement>('[data-retry-resource]');
    if (retryButton) {
      const container = retryButton.closest('.document-image');
      const image = container?.querySelector<HTMLImageElement>('img[data-resource-url]');
      if (!image?.dataset.resourceUrl) {
        return;
      }

      const retryUrl = new URL(image.dataset.resourceUrl);
      retryUrl.searchParams.set('retry', Date.now().toString());
      setImageErrorVisible(image, false);
      image.src = retryUrl.toString();
      return;
    }

    const button = target?.closest<HTMLButtonElement>('[data-copy-code]');
    const code = button?.closest('.code-block')?.querySelector('pre code');
    if (!button || !code) {
      return;
    }

    button.disabled = true;
    void copyText(code.textContent ?? '')
      .then(() => {
        button.textContent = t('已复制');
      })
      .catch(() => {
        button.textContent = t('失败');
      })
      .finally(() => {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = t('复制');
        }, 1200);
      });
  };

  const handleResourceError = (event: Event): void => {
    const image = event.target as HTMLImageElement | null;
    if (image?.matches('img[data-resource-url]')) {
      setImageErrorVisible(image, true);
    }
  };

  const handleResourceLoad = (event: Event): void => {
    const image = event.target as HTMLImageElement | null;
    if (image?.matches('img[data-resource-url]')) {
      setImageErrorVisible(image, false);
    }
  };

  const handleFinishedDocumentKeyDown = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'f') {
      event.preventDefault();
      onFindRequest();
    }
  };

  frameDocument.addEventListener('click', handleFinishedDocumentClick);
  frameDocument.addEventListener('error', handleResourceError, true);
  frameDocument.addEventListener('load', handleResourceLoad, true);
  frameWindow.addEventListener('keydown', handleFinishedDocumentKeyDown);
  frameWindow.addEventListener('scroll', handleViewportScroll, { passive: true });

  for (const image of frameDocument.querySelectorAll<HTMLImageElement>('img[data-resource-url]')) {
    if (image.complete && image.naturalWidth === 0) {
      setImageErrorVisible(image, true);
    }
  }
  onActiveHeadingChange(headingElements[0]?.id);
  scrollAnimationFrame = frameWindow.requestAnimationFrame(updateActiveHeading);
  restoreAnimationFrame = frameWindow.requestAnimationFrame(() => {
    restoreAnimationFrame = frameWindow.requestAnimationFrame(() => {
      restoreAnimationFrame = 0;
      restoreReadingPosition(initialReadingPosition);
      restoringReadingPosition = false;
      updateActiveHeading();
    });
  });

  return {
    applyPlantUmlServer: (serverUrl) => {
      documentRenderAdapter?.setPlantUmlServerUrl(serverUrl);
      for (const task of renderTaskList) {
        if (task.kind === 'plantuml') renderRevision.retry(task.id);
      }
    },
    applyTheme: (preferences) => {
      applyDocumentTheme(frameDocument, preferences);
    },
    clearFind: clearFindHighlights,
    destroy: () => {
      renderRevision.cancel();
      clearFindHighlights();
      if (scrollAnimationFrame) {
        frameWindow.cancelAnimationFrame(scrollAnimationFrame);
      }
      if (restoreAnimationFrame) {
        frameWindow.cancelAnimationFrame(restoreAnimationFrame);
      }
      if (scrollIdleTimer) {
        window.clearTimeout(scrollIdleTimer);
      }
      delete frameDocument.documentElement.dataset.scrollActive;
      frameDocument.removeEventListener('click', handleFinishedDocumentClick);
      frameDocument.removeEventListener('error', handleResourceError, true);
      frameDocument.removeEventListener('load', handleResourceLoad, true);
      frameWindow.removeEventListener('keydown', handleFinishedDocumentKeyDown);
      frameWindow.removeEventListener('scroll', handleViewportScroll);
    },
    find,
    findNext: () => activateFindRange(currentFindIndex + 1),
    findPrevious: () => activateFindRange(currentFindIndex - 1),
    focusRenderedVisualAction: (id, action) => {
      const task = renderTasks.get(id);
      if (!task) return;
      getRenderTaskElement(task)
        ?.querySelector<HTMLButtonElement>(`[data-diagram-action="${action}"]`)
        ?.focus();
    },
    getRenderedVisualSnapshots: () =>
      allRenderTasks.flatMap((task) => getRenderedVisualSnapshot(task) ?? []),
    getReadingPosition,
    getViewportFollowState,
    getRenderSnapshot: () => renderRevision.snapshot(),
    getStaticSnapshotHtml: () => {
      const source = frameDocument.querySelector<HTMLElement>('.finished-document');
      if (!source) throw new TypeError(t('完成文档快照不可用。'));
      const clone = source.cloneNode(true) as HTMLElement;
      for (const control of clone.querySelectorAll(
        '.diagram-action-toolbar, .code-toolbar, .resource-retry-button, .render-task-retry-button, .render-task-skeleton',
      )) {
        control.remove();
      }
      return clone.innerHTML;
    },
    locateRenderedVisual: (id) => {
      const task = renderTasks.get(id);
      if (!task || !renderedVisualTaskKinds.has(task.kind)) return false;
      const element = getRenderTaskElement(task);
      if (!element) return false;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.focus({ preventScroll: true });
      return true;
    },
    restoreReadingPosition,
    scrollToEnd: () => {
      frameWindow.scrollTo({
        left: 0,
        top: Math.max(
          frameDocument.documentElement.scrollHeight,
          frameDocument.body?.scrollHeight ?? 0,
        ),
      });
      updateActiveHeading();
      const position = getReadingPosition();
      onReadingPositionChange(position);
      return position;
    },
    scrollToHeading: (id: string) => {
      const heading = headingElements.find((candidate) => candidate.id === id);
      heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (heading) onActiveHeadingChange(id);
    },
    whenRenderReady: () => renderRevision.whenReady(),
    whenRenderTaskKindsReady: (taskKinds) => renderRevision.whenTaskKindsReady(taskKinds),
  };
}
