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
} from './document-render-adapter';
import { captureReadingPosition, resolveReadingPosition } from './reading-position';

export interface FindResult {
  current: number;
  total: number;
}

export interface FinishedDocumentController {
  applyDiagramOptimization(enabled: boolean): void;
  applyPlantUmlServer(serverUrl: string): void;
  applyTheme(preferences: DocumentThemePreferences): void;
  clearFind(): FindResult;
  destroy(): void;
  find(query: string): FindResult;
  findNext(): FindResult;
  findPrevious(): FindResult;
  focusDiagramAction(id: string, action: 'focus' | 'source'): void;
  getReadingPosition(): ReadingPosition;
  getViewportFollowState(): { distanceFromEnd: number; hasSelection: boolean };
  getRenderSnapshot(): RenderRevisionSnapshot;
  restoreReadingPosition(position: ReadingPosition): void;
  scrollToEnd(): ReadingPosition;
  scrollToHeading(id: string): void;
  whenRenderReady(): Promise<RenderRevisionSnapshot>;
}

export interface DiagramSnapshot {
  id: string;
  kind: 'mermaid' | 'plantuml';
  source: string;
  svg?: string;
}

interface BindFinishedDocumentOptions {
  copyText(text: string): Promise<void>;
  initialAppearance?: 'dark' | 'light';
  initialDiagramOptimization?: boolean;
  initialPlantUmlServerUrl?: string;
  initialReadingPosition: ReadingPosition;
  onActiveHeadingChange(id: string | undefined): void;
  onFindRequest(): void;
  onFocusDiagram?(diagram: DiagramSnapshot): void;
  onInspectDiagram?(diagram: DiagramSnapshot): void;
  onReadingPositionChange(position: ReadingPosition): void;
  onRenderSnapshot?(snapshot: RenderRevisionSnapshot): void;
  renderAdapter?: RenderTaskAdapter<DocumentRenderResult>;
  renderPlantUml?: PlantUmlRenderer;
  renderScheduler?: RenderTaskScheduler;
  renderTimeoutMilliseconds?: number;
  revisionId?: string;
}

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });
let finishedDocumentRevision = 0;

const renderTaskKinds = new Set(['math-display', 'math-inline', 'mermaid', 'plantuml']);

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

const sanitizeDiagramSvg = (frameDocument: Document, source: string): SVGElement => {
  const template = frameDocument.createElement('template');
  template.innerHTML = source;
  const svg = template.content.querySelector('svg');
  if (!svg) throw new TypeError('图表服务没有返回有效的 SVG。');
  for (const element of svg.querySelectorAll('script, foreignObject, iframe, object, embed')) {
    element.remove();
  }
  for (const element of [svg, ...svg.querySelectorAll('*')]) {
    for (const attribute of [...element.attributes]) {
      if (
        attribute.name.toLowerCase().startsWith('on') ||
        ((attribute.name === 'href' || attribute.name.endsWith(':href')) &&
          !attribute.value.startsWith('#'))
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return svg;
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
  let restoreAnimationFrame = 0;
  let restoringReadingPosition = true;
  let appearance =
    options.initialAppearance ??
    (frameDocument.documentElement.dataset.appearance === 'dark' ? 'dark' : 'light');
  const documentRenderAdapter: DocumentRenderAdapter | undefined = options.renderAdapter
    ? undefined
    : createDocumentRenderAdapter(
        appearance,
        options.initialPlantUmlServerUrl ?? defaultPlantUmlServerUrl,
        options.renderPlantUml ??
          (async () => {
            throw new TypeError('PlantUML 渲染服务不可用。');
          }),
        options.initialDiagramOptimization,
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
    action: 'focus' | 'source',
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
    if (task.kind !== 'mermaid' && task.kind !== 'plantuml') continue;
    const element = getRenderTaskElement(task);
    if (!element) continue;
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

  const applyRenderResult = (task: RenderTask, result: DocumentRenderResult): void => {
    const element = getRenderTaskElement(task);
    const output = element?.querySelector<HTMLElement>('.render-task-output');
    if (!element || !output) throw new TypeError('渲染任务占位已不存在。');
    element.setAttribute('aria-busy', 'false');
    if (result.kind === 'math') {
      output.innerHTML = result.html;
    } else {
      output.replaceChildren(sanitizeDiagramSvg(frameDocument, result.svg));
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
        if (task.status === 'pending') setRenderTaskPending(task, task.attempt);
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
      if (!task || (task.kind !== 'mermaid' && task.kind !== 'plantuml')) return;
      const svg = getRenderTaskElement(task)?.querySelector('.render-task-output svg')?.outerHTML;
      const diagram: DiagramSnapshot = {
        id: task.id,
        kind: task.kind,
        source: task.source,
        ...(svg ? { svg } : {}),
      };
      if (diagramAction.dataset.diagramAction === 'source') options.onInspectDiagram?.(diagram);
      if (diagramAction.dataset.diagramAction === 'focus' && svg) options.onFocusDiagram?.(diagram);
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
  frameWindow.addEventListener('scroll', scheduleActiveHeadingUpdate, { passive: true });

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
    applyDiagramOptimization: (enabled) => {
      documentRenderAdapter?.setDiagramOptimization(enabled);
      for (const task of renderTaskList) {
        if (task.kind === 'mermaid' || task.kind === 'plantuml') renderRevision.retry(task.id);
      }
    },
    applyPlantUmlServer: (serverUrl) => {
      documentRenderAdapter?.setPlantUmlServerUrl(serverUrl);
      for (const task of renderTaskList) {
        if (task.kind === 'plantuml') renderRevision.retry(task.id);
      }
    },
    applyTheme: (preferences) => {
      applyDocumentTheme(frameDocument, preferences);
      if (appearance !== preferences.appearance) {
        appearance = preferences.appearance;
        documentRenderAdapter?.setAppearance(appearance);
        for (const task of renderTaskList) {
          if (task.kind === 'mermaid') renderRevision.retry(task.id);
        }
      }
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
      frameDocument.removeEventListener('click', handleFinishedDocumentClick);
      frameDocument.removeEventListener('error', handleResourceError, true);
      frameDocument.removeEventListener('load', handleResourceLoad, true);
      frameWindow.removeEventListener('keydown', handleFinishedDocumentKeyDown);
      frameWindow.removeEventListener('scroll', scheduleActiveHeadingUpdate);
    },
    find,
    findNext: () => activateFindRange(currentFindIndex + 1),
    findPrevious: () => activateFindRange(currentFindIndex - 1),
    focusDiagramAction: (id, action) => {
      const task = renderTasks.get(id);
      if (!task) return;
      getRenderTaskElement(task)
        ?.querySelector<HTMLButtonElement>(`[data-diagram-action="${action}"]`)
        ?.focus();
    },
    getReadingPosition,
    getViewportFollowState,
    getRenderSnapshot: () => renderRevision.snapshot(),
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
