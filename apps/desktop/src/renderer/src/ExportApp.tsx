import { documentThemeCss } from '@fuxian/document-theme';
import { renderMarkdown } from '@fuxian/markdown-renderer';
import type { PdfExportPayload } from '@fuxian/shared-types';
import { useEffect, useRef, useState } from 'react';
import { createDesktopPlantUmlRenderer } from '@/document-render-adapter';
import { bindFinishedDocument, type FinishedDocumentController } from '@/finished-document';
import { waitForExportImages, waitForStableExportLayout } from '@/pdf-export-readiness';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';

const renderPlantUml = createDesktopPlantUmlRenderer(window.fuxian);

const resolveAppearance = (payload: PdfExportPayload): 'dark' | 'light' =>
  payload.preferences.appearance === 'system'
    ? globalThis.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : payload.preferences.appearance;

export function ExportApp({ exportId }: { exportId: string }): React.JSX.Element | null {
  const [payload, setPayload] = useState<PdfExportPayload>();
  const [html, setHtml] = useState<string>();
  const controller = useRef<FinishedDocumentController | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.pdfExport = 'true';
    void window.fuxian
      .getPdfExportPayload(exportId)
      .then((nextPayload) => {
        const rendered = renderMarkdown({
          resourceBaseUrl: nextPayload.document.resourceBaseUrl,
          source: nextPayload.document.source,
        });
        setPayload(nextPayload);
        setHtml(rendered.html);
      })
      .catch((error: unknown) => {
        window.fuxian.signalPdfExportReady({
          exportId,
          message: error instanceof Error ? error.message : '无法准备 PDF 文档。',
          status: 'failed',
        });
      });
    return () => {
      delete document.documentElement.dataset.pdfExport;
    };
  }, [exportId]);

  useEffect(() => {
    if (!payload || html === undefined) return;
    const appearance = resolveAppearance(payload);
    const bound = bindFinishedDocument(document, {
      copyText: window.fuxian.copyText,
      initialAppearance: appearance,
      initialDiagramOptimization: payload.preferences.diagram.optimize,
      initialPlantUmlServerUrl: payload.preferences.plantUml.serverUrl,
      initialReadingPosition: { headingOffset: 0, relativeProgress: 0 },
      onActiveHeadingChange: () => undefined,
      onFindRequest: () => undefined,
      onReadingPositionChange: () => undefined,
      onRenderSnapshot: (snapshot) => {
        const completed = snapshot.readiness.total - snapshot.readiness.pending;
        window.fuxian.reportPdfExportProgress({
          completed,
          exportId,
          total: snapshot.readiness.total,
        });
      },
      renderPlantUml,
      revisionId: `pdf-export:${exportId}`,
    });
    controller.current = bound;
    bound.applyTheme(toDocumentThemePreferences(payload.preferences, appearance));

    void (async () => {
      try {
        await Promise.all([bound.whenRenderReady(), waitForExportImages(document)]);
        await document.fonts.ready;
        await waitForStableExportLayout(window);
        document.documentElement.dataset.exportReady = 'true';
        window.fuxian.signalPdfExportReady({ exportId, status: 'ready' });
      } catch (error) {
        window.fuxian.signalPdfExportReady({
          exportId,
          message: error instanceof Error ? error.message : 'PDF 页面准备失败。',
          status: 'failed',
        });
      }
    })();

    return () => {
      bound.destroy();
      if (controller.current === bound) controller.current = undefined;
    };
  }, [exportId, html, payload]);

  if (html === undefined) return null;
  return (
    <>
      <style>{documentThemeCss}</style>
      <main className="finished-document" dangerouslySetInnerHTML={{ __html: html }} />
    </>
  );
}
