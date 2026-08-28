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
  locateRenderedVisual(id: string): boolean;
  restoreReadingPosition(position: ReadingPosition): void;
  scrollToEnd(): ReadingPosition;
  scrollToHeading(id: string): void;
  whenRenderReady(): Promise<RenderRevisionSnapshot>;
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

const sanitizeInfographicText = (svg: Element): void => {
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
    for (const property of [...span.style]) {
      const value = span.style.getPropertyValue(property).trim();
      if (!allowedInfographicTextStyles.get(property)?.test(value)) {
        span.style.removeProperty(property);
      }
    }
    if (!span.getAttribute('style')?.trim()) span.removeAttribute('style');
  }
};

const collectRenderTasks = (frameDocument: Document): RenderTask[] =>
  Array.from(frameDocument.querySelectorAll<HTMLElement>('[data-render-task-id]')).flatMap(
    (element) => {
      const id = element.dataset.renderTaskId;
      const kind = element.dataset.renderTaskKind;
      const source = element.querySelector<HTMLElement>('.render-task-source')?.textContent;
      return id && kind && source !== undefined && renderTaskKinds.has(kind)
        ? [{ id, kind, source }]
        : [];
    },
  );

export const sanitizeRenderedVisualSvg = (
  frameDocument: Document,
  source: string,
  kind: RenderTask['kind'],
): SVGElement => {
  const template = frameDocument.createElement('template');
  template.innerHTML = source;
  const svg = template.content.firstElementChild;
  if (svg?.localName !== 'svg' || template.content.childElementCount !== 1) {
    throw new TypeError('图表服务没有返回有效的 SVG。');
  }
  if (svg.querySelectorAll('*').length > maximumRenderedVisualElements) {
    throw new TypeError('图表包含过多 SVG 元素。');
  }
  for (const element of svg.querySelectorAll(
    kind === 'infographic'
      ? 'script, iframe, object, embed, image, audio, video, source'
      : 'script, foreignObject, iframe, object, embed, image, audio, video, source',
  )) {
    element.remove();
  }
  if (kind === 'infographic') sanitizeInfographicText(svg);
  for (const anchor of svg.querySelectorAll('a')) anchor.replaceWith(...anchor.childNodes);
  for (const style of svg.querySelectorAll('style')) {
    if (/@import\b|url\s*\(/iu.test(style.textContent ?? '')) style.remove();
  }
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      const urlReferences = [...value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/giu)];
      if (
        name.startsWith('on') ||
        name === 'src' ||
        name === 'formaction' ||
        name === 'xml:base' ||
        ((name === 'href' || name.endsWith(':href')) && !value.startsWith('#')) ||
        urlReferences.some((match) => !match[2]?.startsWith('#'))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
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

const conciseRenderError = (error: string): string => {
  const firstLine =
    error
      .split('\n')
      .find((line) => line.trim())
      ?.trim() ?? '渲染任务失败。';
  return firstLine.length > 240 ? `${firstLine.slice(0, 237)}...` : firstLine;
};

export const applyDocumentTheme = (
  frameDocument: Document,
  preferences: DocumentThemePreferences,
): void => {
  const root = frameDocument.documentElement;
  if (!root) return;

  root.dataset.appearance = preferences.appearance;
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

  const headingElements = Array.from(
    frameDocument.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]'),
  ).filter((heading) => !heading.matches('.sr-only') && !heading.closest('[hidden]'));
  const findRanges: Range[] = [];
  let currentFindIndex = -1;
  let scrollAnimationFrame = 0;
  let scrollIdleTimer = 0;
  let restoreAnimationFrame = 0;
  let restoringReadingPosition = true;
  const documentRenderAdapter: DocumentRenderAdapter | undefined = options.renderAdapter
    ? undefined
    : createDocumentRenderAdapter(
        options.initialPlantUmlServerUrl ?? defaultPlantUmlServerUrl,
        options.renderPlantUml ??
          (async () => {
            throw new TypeError('PlantUML 渲染服务不可用。');
          }),
        options.renderVegaLite,
        options.renderInfographic,
      );
  const renderTaskList = collectRenderTasks(frameDocument);
  const renderTasks = new Map(renderTaskList.map((task) => [task.id, task]));
  const renderTaskElements = new Map(
    Array.from(frameDocument.querySelectorAll<HTMLElement>('[data-render-task-id]')).flatMap(
      (element) =>
        element.dataset.renderTaskId ? [[element.dataset.renderTaskId, element] as const] : [],
    ),
  );
  const getRenderTaskElement = (task: RenderTask): HTMLElement | undefined =>
    renderTaskElements.get(task.id);
  const diagramContexts = new Map(
    renderTaskList
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
              contextLabel: `${headingText || '文档开头'} · 图表 ${ordinal}`,
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

  for (const task of renderTaskList) {
    if (!renderedVisualTaskKinds.has(task.kind)) continue;
    const element = getRenderTaskElement(task);
    if (!element) continue;
    const visual = getRenderedVisualSnapshot(task);
    if (visual) {
      element.ariaLabel = `${renderedVisualLabel(task.kind)} 图表 ${visual.ordinal}，${visual.headingText || '文档开头'}`;
      element.tabIndex = -1;
    }
    const toolbar = frameDocument.createElement('span');
    toolbar.ariaLabel = '图表操作';
    toolbar.className = 'diagram-action-toolbar';
    toolbar.role = 'toolbar';
    toolbar.append(
      createDiagramAction('source', '查看图表源码', Code2),
      createDiagramAction('focus', '全屏查看图表', Maximize2),
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
    const output = element.querySelector<HTMLElement>('.render-task-output');
    const error = element.querySelector<HTMLElement>('.render-task-error');
    if (source) source.hidden = false;
    if (output) output.hidden = true;
    if (error) error.hidden = true;
  };

  const applyRenderResult = async (
    task: RenderTask,
    result: DocumentRenderResult,
  ): Promise<void> => {
    const element = getRenderTaskElement(task);
    const output = element?.querySelector<HTMLElement>('.render-task-output');
    if (!element || !output) throw new TypeError('渲染任务占位已不存在。');
    element.setAttribute('aria-busy', 'false');
    if (result.kind === 'math') {
      output.innerHTML = result.html;
    } else {
      const svg = sanitizeRenderedVisualSvg(frameDocument, result.svg, task.kind);
      if (task.kind === 'plantuml') normalizePlantUmlSvgSize(svg);
      output.replaceChildren(svg);
    }
    element.querySelector<HTMLElement>('.render-task-source')?.setAttribute('hidden', '');
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
    if (detail)
      detail.textContent =
        status === 'timed-out' ? '渲染超时，请重试。' : conciseRenderError(error);
    element.querySelector<HTMLElement>('.render-task-source')?.setAttribute('hidden', '');
    element.querySelector<HTMLElement>('.render-task-output')?.setAttribute('hidden', '');
    const errorElement = element.querySelector<HTMLElement>('.render-task-error');
    if (errorElement) errorElement.hidden = false;
  };

  const renderCoordinator = new RenderCoordinator<DocumentRenderResult>({
    adapter: options.renderAdapter ?? documentRenderAdapter!,
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
    let activeHeading = headingElements[0];
    for (const heading of headingElements) {
      if (heading.getBoundingClientRect().top > activationLine) {
        break;
      }
      activeHeading = heading;
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
    const walker = frameDocument.createTreeWalker(
      frameDocument.querySelector('.finished-document') ?? frameDocument.body,
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
        button.textContent = '已复制';
      })
      .catch(() => {
        button.textContent = '失败';
      })
      .finally(() => {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = '复制';
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
      renderTaskList.flatMap((task) => getRenderedVisualSnapshot(task) ?? []),
    getReadingPosition,
    getViewportFollowState,
    getRenderSnapshot: () => renderRevision.snapshot(),
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
      frameDocument.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    whenRenderReady: () => renderRevision.whenReady(),
  };
}
