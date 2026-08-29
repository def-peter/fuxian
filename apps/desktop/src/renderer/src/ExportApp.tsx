import { documentThemeCss } from '@fuxian/document-theme';
import type { PdfExportPayload } from '@fuxian/shared-types';
import { useEffect, useRef } from 'react';
import {
  applyPaperTheme,
  paginateFinishedDocument,
  paperPagedMediaCss,
  paperRuntimeCss,
  type PaginatedDocument,
} from './paper-pagination';
import { toDocumentThemePreferences } from './reader-preferences-theme';

const resolveAppearance = (payload: PdfExportPayload): 'dark' | 'light' =>
  payload.preferences.appearance === 'system'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : payload.preferences.appearance;

export function ExportApp({ exportId }: { exportId: string }): React.JSX.Element {
  const viewport = useRef<HTMLElement>(null);

  useEffect(() => {
    let disposed = false;
    let pagination: PaginatedDocument | undefined;
    const abortController = new AbortController();
    document.documentElement.dataset.pdfExport = 'true';

    void (async () => {
      try {
        const payload = await window.fuxian.getPdfExportPayload(exportId);
        if (disposed) return;
        applyPaperTheme(
          document,
          toDocumentThemePreferences(payload.preferences, resolveAppearance(payload)),
        );
        window.fuxian.reportPdfExportProgress({ completed: 0, exportId, total: 1 });
        pagination = await paginateFinishedDocument({
          document,
          html: payload.finishedDocumentHtml,
          signal: abortController.signal,
        });
        if (disposed) return;
        viewport.current?.replaceChildren(pagination.element);
        await document.fonts.ready;
        await new Promise<void>((resolve) =>
          globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve())),
        );
        document.documentElement.dataset.exportReady = 'true';
        document.documentElement.dataset.paperPageCount = `${pagination.pageCount}`;
        window.fuxian.reportPdfExportProgress({ completed: 1, exportId, total: 1 });
        window.fuxian.signalPdfExportReady({
          exportId,
          pageCount: pagination.pageCount,
          status: 'ready',
        });
      } catch (error) {
        if (abortController.signal.aborted) return;
        window.fuxian.signalPdfExportReady({
          exportId,
          message: error instanceof Error ? error.message : '无法准备 PDF 文档。',
          status: 'failed',
        });
      }
    })();

    return () => {
      disposed = true;
      abortController.abort();
      pagination?.cleanup();
      delete document.documentElement.dataset.exportReady;
      delete document.documentElement.dataset.pdfExport;
      delete document.documentElement.dataset.paperPageCount;
    };
  }, [exportId]);

  return (
    <>
      <style data-pagedjs-ignore="true" media="screen">
        {documentThemeCss}
      </style>
      <style data-pagedjs-ignore="true">{paperPagedMediaCss}</style>
      <style data-pagedjs-ignore="true">{paperRuntimeCss}</style>
      <main aria-label="PDF 分页文档" className="paper-preview-viewport" ref={viewport} />
    </>
  );
}
