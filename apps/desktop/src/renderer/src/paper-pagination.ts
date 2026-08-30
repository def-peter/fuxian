import {
  documentThemeCss,
  getDocumentThemeVariables,
  type DocumentThemePreferences,
} from '@fuxian/document-theme';

export const paperPageWidthPixels = (210 / 25.4) * 96;
const maximumRowsPerTableFragment = 8;
const maximumTableRowsHeightPixels = 780;

export const paperPagedMediaCss = `
@page {
  size: A4 portrait;
  margin: 18mm 16mm;
}

.finished-document {
  width: 100%;
  margin: 0;
  padding: 0;
}

h1, h2, h3, h4, h5, h6 {
  break-after: avoid;
}

table {
  display: table;
  width: 100%;
  overflow: visible;
}

thead {
  display: table-header-group;
}

tr, .code-block, .document-image, .math-render-task:not(.math-render-task-inline),
.diagram-render-task, .diagram-render-task > .render-task-output,
.diagram-render-task svg, .resource-error {
  break-inside: avoid;
}

.paper-table-fragment {
  break-inside: avoid;
}

.paper-table-fragment:not(:has(tbody tr)) {
  display: none;
}

.code-block pre code {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.diagram-render-task > .render-task-output {
  overflow: visible;
}

.diagram-render-task svg,
.document-image > img,
.math-render-task math[display="block"] {
  max-width: 100%;
  max-height: 245mm;
  object-fit: contain;
}

.paper-rendered-visual-placeholder {
  display: block;
  max-width: 100%;
  margin: 28px auto;
  break-inside: avoid;
}

.paper-rendered-visual-page-break {
  display: block;
  break-before: page;
  break-inside: avoid;
}

.diagram-render-task[data-render-task-kind="plantuml"] svg {
  max-height: 245mm;
}

.diagram-action-toolbar {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  width: auto;
  height: 22px;
  margin: 0;
}

.paper-table-row-fallback {
  margin: 28px 0;
  border: 1px solid var(--document-border);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.55;
}

.paper-table-row-fallback-title,
.paper-table-row-fallback-cell {
  padding: 10px 12px;
  overflow-wrap: anywhere;
}

.paper-table-row-fallback-title {
  border-bottom: 1px solid var(--document-border);
  background: var(--document-table-heading);
  font-weight: 650;
}

.paper-table-row-fallback-cell + .paper-table-row-fallback-cell {
  border-top: 1px solid var(--document-border);
}

.paper-table-row-fallback-label {
  display: block;
  margin-bottom: 4px;
  color: var(--document-muted);
  font-size: 12px;
  font-weight: 650;
}

@media print {
  :root[data-pdf-export] .diagram-action-toolbar,
  :root[data-pdf-export] .code-toolbar,
  :root[data-pdf-export] .resource-retry-button,
  :root[data-pdf-export] .render-task-retry-button {
    display: none !important;
  }

  .pagedjs_pages {
    display: block !important;
    background: white !important;
  }

  .pagedjs_page {
    margin: 0 !important;
    border: 0 !important;
    box-shadow: none !important;
  }
}
`;

export const paperRuntimeCss = `
html[data-paper-preview], html[data-paper-preview] body {
  min-height: 100%;
  background: #f2f5f7;
}

html[data-pdf-export], html[data-pdf-export] body {
  background: white;
}

body {
  overflow-x: hidden;
}

.paper-preview-viewport {
  min-height: 100vh;
  padding: 20px;
  overflow: auto;
}

.paper-preview-pages > .pagedjs_pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: max-content;
  min-width: 100%;
  zoom: var(--paper-preview-scale, 1);
}

.paper-preview-pages.paper-pagination-staging > .pagedjs_pages {
  zoom: 1;
}

.paper-preview-pages .pagedjs_page {
  flex: none;
  margin: 0;
  background: var(--document-background);
  box-shadow: 0 1px 7px rgb(20 30 34 / 13%);
}

.paper-preview-status {
  position: fixed;
  top: 12px;
  right: 14px;
  z-index: 2;
  padding: 5px 8px;
  border: 1px solid #d8dddf;
  border-radius: 4px;
  color: #566166;
  background: rgb(255 255 255 / 92%);
  font: 12px/1.4 Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  box-shadow: 0 1px 5px rgb(20 30 34 / 10%);
}

.paper-preview-status[hidden] {
  display: none;
}

.paper-pagination-staging {
  position: fixed;
  top: 0;
  left: -100000px;
  width: ${paperPageWidthPixels}px;
  visibility: hidden;
  pointer-events: none;
}

@media print {
  .paper-preview-viewport {
    min-height: 0;
    padding: 0;
    overflow: visible;
  }

  .paper-preview-pages > .pagedjs_pages {
    display: block;
    width: auto;
    min-width: 0;
    zoom: 1;
  }

  .paper-preview-status,
  .paper-pagination-staging {
    display: none !important;
  }

  .paper-preview-pages .pagedjs_page {
    box-shadow: none;
  }
}
`;

const waitForAnimationFrames = (window: Window, count: number): Promise<void> =>
  new Promise((resolve) => {
    const next = (remaining: number): void => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(() => next(remaining - 1));
    };
    next(count);
  });

const waitForImage = (image: HTMLImageElement): Promise<void> => {
  image.loading = 'eager';
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    const settle = (): void => {
      image.removeEventListener('load', settle);
      image.removeEventListener('error', settle);
      resolve();
    };
    image.addEventListener('load', settle, { once: true });
    image.addEventListener('error', settle, { once: true });
  });
};

const svgFallbackSize = (svg: SVGSVGElement, axis: 'height' | 'width'): number => {
  const viewBox = svg.viewBox.baseVal;
  const viewBoxSize = axis === 'width' ? viewBox.width : viewBox.height;
  const length = axis === 'width' ? svg.width.baseVal.value : svg.height.baseVal.value;
  return Math.max(1, length || viewBoxSize || 1);
};

const makeRenderedVisualsAtomic = (
  root: ParentNode,
): {
  findInvalid(destination: ParentNode): Set<string>;
  forceAllPageBreaks(): void;
  forcePageBreaks(ids: Iterable<string>): void;
  restore(destination: ParentNode): void;
} => {
  const originals = new Map<string, HTMLElement>();
  const sourcePlaceholders = new Map<string, HTMLDivElement>();
  const pageBreakWrappers = new Map<string, HTMLDivElement>();
  const renderTasks = Array.from(root.querySelectorAll<HTMLElement>('.diagram-render-task')).filter(
    (renderTask) => renderTask.querySelector(':scope > .render-task-output > svg'),
  );
  for (const [index, renderTask] of renderTasks.entries()) {
    const svg = renderTask.querySelector<SVGSVGElement>(':scope > .render-task-output > svg');
    if (!svg) continue;
    const bounds = renderTask.getBoundingClientRect();
    const id = `paper-rendered-visual-${index}`;
    const source = renderTask.querySelector<HTMLElement>('.render-task-source')?.textContent;
    if (source !== undefined) renderTask.dataset.staticRenderTaskSource = source;
    const placeholder = svg.ownerDocument.createElement('div');
    const width = Math.max(1, bounds.width || svgFallbackSize(svg, 'width'));
    const height = Math.max(1, bounds.height || svgFallbackSize(svg, 'height'));
    placeholder.ariaHidden = 'true';
    placeholder.className = 'paper-rendered-visual-placeholder';
    placeholder.dataset.paperRenderedVisual = id;
    placeholder.style.height = `${height}px`;
    placeholder.style.width = `${width}px`;
    originals.set(id, renderTask);
    sourcePlaceholders.set(id, placeholder);
    renderTask.replaceWith(placeholder);
  }

  const forcePageBreaks = (ids: Iterable<string>): void => {
    for (const id of ids) {
      const placeholder = sourcePlaceholders.get(id);
      if (!placeholder || pageBreakWrappers.has(id)) continue;
      const wrapper = placeholder.ownerDocument.createElement('div');
      wrapper.className = 'paper-rendered-visual-page-break';
      placeholder.replaceWith(wrapper);
      wrapper.append(placeholder);
      pageBreakWrappers.set(id, wrapper);
    }
  };

  return {
    findInvalid: (destination) => {
      const occurrences = new Map<string, HTMLElement[]>();
      for (const placeholder of destination.querySelectorAll<HTMLElement>(
        '[data-paper-rendered-visual]',
      )) {
        const id = placeholder.dataset.paperRenderedVisual;
        if (!id || !originals.has(id)) continue;
        const current = occurrences.get(id) ?? [];
        current.push(placeholder);
        occurrences.set(id, current);
      }
      const invalid = new Set<string>();
      for (const id of originals.keys()) {
        const matches = occurrences.get(id) ?? [];
        const fitting = matches.filter((placeholder) => {
          const page = placeholder.closest<HTMLElement>('.pagedjs_page');
          if (!page) return false;
          const bounds = placeholder.getBoundingClientRect();
          const pageBounds = page.getBoundingClientRect();
          const tolerance = 1;
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.left >= pageBounds.left - tolerance &&
            bounds.right <= pageBounds.right + tolerance &&
            bounds.top >= pageBounds.top - tolerance &&
            bounds.bottom <= pageBounds.bottom + tolerance
          );
        });
        const keeper = fitting[0];
        if (!keeper) {
          invalid.add(id);
          continue;
        }
        for (const duplicate of matches) {
          if (duplicate === keeper) continue;
          const wrapper = duplicate.closest<HTMLElement>('.paper-rendered-visual-page-break');
          if (wrapper) wrapper.remove();
          else duplicate.remove();
        }
      }
      return invalid;
    },
    forceAllPageBreaks: () => forcePageBreaks(originals.keys()),
    forcePageBreaks,
    restore: (destination) => {
      const placeholders = destination.querySelectorAll<HTMLElement>(
        '[data-paper-rendered-visual]',
      );
      if (placeholders.length !== originals.size) {
        throw new Error('分页图表占位数量不一致。');
      }
      for (const placeholder of placeholders) {
        const id = placeholder.dataset.paperRenderedVisual;
        const renderTask = id ? originals.get(id) : undefined;
        if (!renderTask) throw new Error('分页图表占位无法恢复。');
        const wrapper = placeholder.closest<HTMLElement>('.paper-rendered-visual-page-break');
        if (wrapper) wrapper.replaceWith(renderTask);
        else placeholder.replaceWith(renderTask);
      }
    },
  };
};

const createTableFragment = (table: HTMLTableElement, rows: HTMLTableRowElement[]): HTMLElement => {
  const fragment = table.cloneNode(true) as HTMLTableElement;
  for (const child of Array.from(fragment.children)) {
    if (child.localName === 'tbody') child.remove();
  }
  const body = fragment.ownerDocument.createElement('tbody');
  body.append(...rows.map((row) => row.cloneNode(true)));
  fragment.append(body);
  fragment.classList.add('paper-table-fragment');
  return fragment;
};

const createTableRowFallback = (
  document: Document,
  headers: string[],
  row: HTMLTableRowElement,
): HTMLElement => {
  const fallback = document.createElement('section');
  fallback.className = 'paper-table-row-fallback';
  fallback.dataset.paperTableFallback = 'true';
  fallback.ariaLabel = '表格中的超长内容';

  const title = document.createElement('div');
  title.className = 'paper-table-row-fallback-title';
  title.textContent = '表格内容（单行超过一页，已转为连续排版）';
  fallback.append(title);

  const cells = Array.from(row.children).filter(
    (child): child is HTMLTableCellElement => child.localName === 'td' || child.localName === 'th',
  );
  for (const [index, cell] of cells.entries()) {
    const item = document.createElement('div');
    item.className = 'paper-table-row-fallback-cell';
    const label = document.createElement('span');
    label.className = 'paper-table-row-fallback-label';
    label.textContent = headers[index] || `第 ${index + 1} 列`;
    item.append(label, ...Array.from(cell.childNodes).map((node) => node.cloneNode(true)));
    fallback.append(item);
  }
  return fallback;
};

export const splitLongTables = (
  root: ParentNode,
  measureRow: (row: HTMLTableRowElement) => number = (row) => row.getBoundingClientRect().height,
): void => {
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>('table'))) {
    const bodies = Array.from(table.children).filter(
      (child): child is HTMLTableSectionElement => child.localName === 'tbody',
    );
    const rows = bodies.flatMap((body) =>
      Array.from(body.children).filter(
        (child): child is HTMLTableRowElement => child.localName === 'tr',
      ),
    );
    if (rows.length === 0) continue;
    const head = Array.from(table.children).find((child) => child.localName === 'thead');
    const headerRow = Array.from(head?.children ?? []).findLast(
      (child) => child.localName === 'tr',
    );
    const headers = Array.from(headerRow?.children ?? [])
      .filter((child) => child.localName === 'th' || child.localName === 'td')
      .map((cell) => cell.textContent?.trim() ?? '');
    const replacements: HTMLElement[] = [];
    let group: HTMLTableRowElement[] = [];
    let groupHeight = 0;
    const flush = (): void => {
      if (group.length === 0) return;
      replacements.push(createTableFragment(table, group));
      group = [];
      groupHeight = 0;
    };

    for (const row of rows) {
      const rowHeight = Math.max(1, measureRow(row));
      if (rowHeight > maximumTableRowsHeightPixels) {
        flush();
        replacements.push(createTableRowFallback(table.ownerDocument, headers, row));
        continue;
      }
      if (
        group.length >= maximumRowsPerTableFragment ||
        groupHeight + rowHeight > maximumTableRowsHeightPixels
      ) {
        flush();
      }
      group.push(row);
      groupHeight += rowHeight;
    }
    flush();
    if (replacements.length > 1 || replacements[0]?.matches('.paper-table-row-fallback')) {
      table.replaceWith(...replacements);
    }
  }
};

export const applyPaperTheme = (
  document: Document,
  preferences: DocumentThemePreferences,
): void => {
  document.documentElement.dataset.appearance = preferences.appearance;
  for (const [name, value] of Object.entries(getDocumentThemeVariables(preferences))) {
    document.documentElement.style.setProperty(name, value);
  }
};

export interface PaginatedDocument {
  cleanup(): void;
  element: HTMLElement;
  pageCount: number;
}

export const paginateFinishedDocument = async ({
  document,
  html,
  signal,
  timeoutMilliseconds = 20_000,
}: {
  document: Document;
  html: string;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
}): Promise<PaginatedDocument> => {
  if (signal?.aborted) throw new DOMException('分页任务已取消。', 'AbortError');
  const frameWindow = document.defaultView;
  if (!frameWindow) throw new TypeError('分页文档没有活动窗口。');

  const sourceStage = document.createElement('div');
  sourceStage.className = 'paper-pagination-staging';
  const source = document.createElement('main');
  source.className = 'finished-document';
  source.innerHTML = html;
  sourceStage.append(source);
  document.body.append(sourceStage);

  const destination = document.createElement('section');
  destination.className = 'paper-preview-pages paper-pagination-staging';
  destination.ariaLabel = '分页后的完成文档';
  document.body.append(destination);

  let previewer: import('pagedjs').Previewer | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let completed = false;
  const stop = (): void => previewer?.chunker.stop();
  signal?.addEventListener('abort', stop, { once: true });

  try {
    await Promise.all(Array.from(source.querySelectorAll('img')).map(waitForImage));
    await document.fonts.ready;
    await waitForAnimationFrames(frameWindow, 2);
    splitLongTables(source);
    const renderedVisuals = makeRenderedVisualsAtomic(source);

    const { Previewer } = await import('pagedjs');
    const stylesheetUrl = new URL(document.location.href).href;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        previewer?.chunker.stop();
        reject(new Error('纸张分页超时。'));
      }, timeoutMilliseconds);
    });

    let pageCount = 0;
    let attempt = 0;
    while (attempt < 3) {
      previewer = new Previewer();
      if (signal?.aborted) throw new DOMException('分页任务已取消。', 'AbortError');
      const pagination = previewer.preview(
        source.outerHTML,
        [{ [stylesheetUrl]: documentThemeCss }, { [stylesheetUrl]: paperPagedMediaCss }],
        destination,
      );
      const flow = await Promise.race([pagination, timedOut]);
      if (signal?.aborted) throw new DOMException('分页任务已取消。', 'AbortError');
      pageCount = destination.querySelectorAll('.pagedjs_page').length;
      if (pageCount === 0 || pageCount !== flow.total) {
        throw new Error('分页结果不完整。');
      }
      const invalidVisuals = renderedVisuals.findInvalid(destination);
      if (invalidVisuals.size === 0) break;
      previewer.polisher.destroy();
      destination.replaceChildren();
      previewer = undefined;
      if (attempt === 0) renderedVisuals.forcePageBreaks(invalidVisuals);
      else renderedVisuals.forceAllPageBreaks();
      attempt += 1;
    }
    const remainingInvalidVisuals = renderedVisuals.findInvalid(destination);
    if (!previewer || remainingInvalidVisuals.size > 0) {
      throw new Error('图表无法完整放入纸张页面。');
    }
    renderedVisuals.restore(destination);
    destination.classList.remove('paper-pagination-staging');
    destination.dataset.pageCount = `${pageCount}`;
    destination.remove();
    completed = true;
    const insertedStyles = [previewer.polisher.styleEl, ...previewer.polisher.inserted];
    return {
      cleanup: () => {
        for (const style of insertedStyles) style.remove();
      },
      element: destination,
      pageCount,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
    signal?.removeEventListener('abort', stop);
    sourceStage.remove();
    if (!completed) {
      destination.remove();
      previewer?.polisher.destroy();
    }
  }
};
