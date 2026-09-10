import {
  documentThemeCss,
  getDocumentThemeVariables,
  type DocumentThemePreferences,
} from '@fuxian/document-theme';
import type { Translator } from '../../localization';

export const paperPageWidthPixels = (210 / 25.4) * 96;
export const paperPageHeightPixels = (297 / 25.4) * 96;
export const paperPageMarginBlockMillimeters = 14;
export const paperPageMarginInlineMillimeters = 12;
const paperContentHeightPixels = ((297 - 2 * paperPageMarginBlockMillimeters) / 25.4) * 96;

export const paperPagedMediaCss = `
@page {
  size: A4 portrait;
  margin: ${paperPageMarginBlockMillimeters}mm ${paperPageMarginInlineMillimeters}mm;
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

th,
td {
  min-width: 0;
}

thead {
  display: table-row-group;
  break-after: avoid;
}

tr, .code-block, .document-image, .math-render-task:not(.math-render-task-inline),
.diagram-render-task, .diagram-render-task > .render-task-output,
.diagram-render-task svg, .resource-error {
  break-inside: avoid;
}

.paper-table-start {
  break-inside: avoid;
}

.paper-table-oversized-row,
.paper-table-oversized-row td {
  break-inside: auto;
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
/* Paged.js has already placed content inside the A4 margin boxes. This
   stylesheet is excluded from pagination: native printing must not apply
   the source @page margins again or shrink the completed page to fit them. */
@media print {
  @page {
    margin: 0 !important;
  }
}

html[data-paper-preview] {
  height: auto;
  min-height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
}

html[data-paper-preview] body,
html[data-paper-preview] #root {
  height: auto;
  min-height: 100%;
  overflow: visible;
}

html[data-paper-preview], html[data-paper-preview] body {
  background: transparent;
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
  overflow: visible;
}

.paper-preview-pages > .pagedjs_pages {
  display: block;
  width: max-content;
  min-width: 100%;
  background: transparent !important;
  zoom: var(--paper-preview-scale, 1);
}

.paper-preview-pages.paper-pagination-staging > .pagedjs_pages {
  zoom: 1;
}

.paper-preview-pages .pagedjs_page {
  flex: none;
  margin: 0 auto !important;
  background: var(--document-background);
}

@media screen {
  .paper-preview-pages .pagedjs_page {
    box-shadow:
      0 2px 12px var(--document-paper-shadow),
      0 1px 2px var(--document-paper-edge-shadow) !important;
  }

  .paper-preview-pages .pagedjs_page + .pagedjs_page {
    margin-top: 20px !important;
  }
}

.paper-preview-status {
  position: fixed;
  top: 12px;
  right: 14px;
  z-index: 2;
  padding: 5px 8px;
  border: 1px solid var(--document-border);
  border-radius: 4px;
  color: var(--document-muted);
  background: color-mix(in srgb, var(--document-raised) 92%, transparent);
  font: 12px/1.4 Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  box-shadow: 0 1px 5px var(--document-overlay-shadow);
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
    margin: 0 !important;
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
  t: Translator,
): {
  findInvalid(destination: ParentNode): Set<string>;
  forceAllPageBreaks(): void;
  forcePageBreaks(ids: Iterable<string>): void;
  restore(destination: ParentNode): void;
} => {
  const originals = new Map<string, HTMLElement>();
  const sourcePlaceholders = new Map<string, HTMLDivElement>();
  const pageBreakWrappers = new Map<string, HTMLDivElement>();
  // Keep MathML internals out of Paged.js fragmentation just like SVG internals.
  // The original, selectable formula is restored after its measured box is placed.
  const renderTasks = Array.from(
    root.querySelectorAll<HTMLElement>(
      '.diagram-render-task, .math-render-task:not(.math-render-task-inline)',
    ),
  ).filter((renderTask) =>
    renderTask.querySelector(
      ':scope > .render-task-output > svg, :scope > .render-task-output math[display="block"]',
    ),
  );
  for (const [index, renderTask] of renderTasks.entries()) {
    const svg = renderTask.querySelector<SVGSVGElement>(':scope > .render-task-output > svg');
    const bounds = renderTask.getBoundingClientRect();
    const id = `paper-rendered-visual-${index}`;
    const source = renderTask.querySelector<HTMLElement>('.render-task-source')?.textContent;
    if (source !== undefined) renderTask.dataset.staticRenderTaskSource = source;
    const placeholder = renderTask.ownerDocument.createElement('div');
    const width = Math.max(1, bounds.width || (svg ? svgFallbackSize(svg, 'width') : 1));
    const height = Math.max(1, bounds.height || (svg ? svgFallbackSize(svg, 'height') : 1));
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
        throw new Error(t('分页图表占位数量不一致。'));
      }
      for (const placeholder of placeholders) {
        const id = placeholder.dataset.paperRenderedVisual;
        const renderTask = id ? originals.get(id) : undefined;
        if (!renderTask) throw new Error(t('分页图表占位无法恢复。'));
        const wrapper = placeholder.closest<HTMLElement>('.paper-rendered-visual-page-break');
        if (wrapper) wrapper.replaceWith(renderTask);
        else placeholder.replaceWith(renderTask);
      }
    },
  };
};

export const preparePaperTables = (
  root: ParentNode,
  measureRow: (row: HTMLTableRowElement) => number = (row) => row.getBoundingClientRect().height,
): void => {
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>('table'))) {
    table.style.display = 'table';
    table.style.width = '100%';
    table.style.overflow = 'visible';
    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>(':scope > tbody > tr'));
    if (rows.length === 0) continue;
    const cells = Array.from(table.querySelectorAll<HTMLTableCellElement>('th, td'));
    for (const cell of cells) cell.style.minWidth = '0';
    const allRows = Array.from(table.querySelectorAll<HTMLTableRowElement>('tr'));
    // Pin the complete table's column proportions before any page is fragmented.
    // Cell widths survive Paged.js ancestor cloning even when colgroups do not.
    const widths = allRows.map((row) =>
      Array.from(row.children).map((cell) => cell.getBoundingClientRect().width),
    );
    allRows.forEach((row, rowIndex) => {
      const measured = widths[rowIndex]!;
      const total = measured.reduce((sum, width) => sum + width, 0);
      if (total <= 0) return;
      Array.from(row.children).forEach((cell, index) => {
        (cell as HTMLElement).style.width = `${(measured[index]! / total) * 100}%`;
      });
    });
    table.style.tableLayout = 'fixed';
    const head = table.querySelector(':scope > thead');
    const headHeight = Array.from(head?.querySelectorAll<HTMLTableRowElement>('tr') ?? []).reduce(
      (sum, row) => sum + measureRow(row),
      0,
    );
    for (const row of rows) {
      const availableHeight = paperContentHeightPixels - (row === rows[0] ? headHeight : 0);
      if (measureRow(row) > availableHeight) row.classList.add('paper-table-oversized-row');
    }
    if (head && !rows[0]!.classList.contains('paper-table-oversized-row')) {
      const start = table.ownerDocument.createElement('tbody');
      start.className = 'paper-table-start';
      start.append(...Array.from(head.children), rows[0]!);
      head.replaceWith(start);
    }
  }
};

export const applyPaperTheme = (
  document: Document,
  preferences: DocumentThemePreferences,
): void => {
  document.documentElement.dataset.appearance = preferences.appearance;
  document.documentElement.dataset.codeTheme = preferences.codeTheme;
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
  translate: t,
}: {
  document: Document;
  html: string;
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
  translate: Translator;
}): Promise<PaginatedDocument> => {
  if (signal?.aborted) throw new DOMException(t('分页任务已取消。'), 'AbortError');
  const frameWindow = document.defaultView;
  if (!frameWindow) throw new TypeError(t('分页文档没有活动窗口。'));

  const sourceStage = document.createElement('div');
  sourceStage.className = 'paper-pagination-staging';
  const source = document.createElement('main');
  source.className = 'finished-document';
  source.style.width = `${((210 - 2 * paperPageMarginInlineMillimeters) / 25.4) * 96}px`;
  source.style.padding = '0';
  source.style.margin = '0';
  source.innerHTML = html;
  sourceStage.append(source);
  document.body.append(sourceStage);

  const destination = document.createElement('section');
  destination.className = 'paper-preview-pages paper-pagination-staging';
  destination.ariaLabel = t('分页后的完成文档');
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
    preparePaperTables(source);
    const renderedVisuals = makeRenderedVisualsAtomic(source, t);

    const { Previewer } = await import('pagedjs');
    const stylesheetUrl = new URL(document.location.href).href;
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        previewer?.chunker.stop();
        reject(new Error(t('纸张分页超时。')));
      }, timeoutMilliseconds);
    });

    let pageCount = 0;
    let attempt = 0;
    while (attempt < 3) {
      previewer = new Previewer();
      if (signal?.aborted) throw new DOMException(t('分页任务已取消。'), 'AbortError');
      const pagination = previewer.preview(
        source.outerHTML,
        [{ [stylesheetUrl]: documentThemeCss }, { [stylesheetUrl]: paperPagedMediaCss }],
        destination,
      );
      const flow = await Promise.race([pagination, timedOut]);
      if (signal?.aborted) throw new DOMException(t('分页任务已取消。'), 'AbortError');
      pageCount = destination.querySelectorAll('.pagedjs_page').length;
      if (pageCount === 0 || pageCount !== flow.total) {
        throw new Error(t('分页结果不完整。'));
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
      throw new Error(t('图表无法完整放入纸张页面。'));
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
