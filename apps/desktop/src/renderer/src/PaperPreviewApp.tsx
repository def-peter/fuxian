import { documentThemeCss } from '@fuxian/document-theme';
import { useEffect, useRef, useState } from 'react';
import { bindFinishedDocument, type FinishedDocumentController } from './finished-document';
import {
  applyPaperTheme,
  paginateFinishedDocument,
  paperPageWidthPixels,
  paperPagedMediaCss,
  paperRuntimeCss,
  type PaginatedDocument,
} from './paper-pagination';
import {
  isPaperPreviewHostMessage,
  type PaperPreviewFrameMessage,
  type PaperPreviewFramePayload,
  type PaperPreviewHostMessage,
  type PaperPreviewSnapshot,
} from './paper-preview-protocol';

const channelId = new URLSearchParams(globalThis.location.search).get('channelId') ?? '';

const postToHost = (message: PaperPreviewFramePayload): void => {
  globalThis.parent.postMessage(
    { ...message, channelId, scope: 'fuxian-paper-preview' } as PaperPreviewFrameMessage,
    '*',
  );
};

const fitPaperToViewport = (): void => {
  const availableWidth = Math.max(320, globalThis.innerWidth - 40);
  const scale = Math.min(1.5, availableWidth / paperPageWidthPixels);
  document.documentElement.style.setProperty('--paper-preview-scale', `${scale}`);
};

export function PaperPreviewApp(): React.JSX.Element {
  const viewport = useRef<HTMLElement>(null);
  const currentController = useRef<FinishedDocumentController | undefined>(undefined);
  const currentPagination = useRef<PaginatedDocument | undefined>(undefined);
  const currentRevisionId = useRef<string | undefined>(undefined);
  const latestSnapshot = useRef<PaperPreviewSnapshot | undefined>(undefined);
  const activeAbortController = useRef<AbortController | undefined>(undefined);
  const processing = useRef(false);
  const [status, setStatus] = useState('正在准备纸张...');

  useEffect(() => {
    document.documentElement.dataset.paperPreview = 'true';
    fitPaperToViewport();
    const handleResize = (): void => fitPaperToViewport();
    globalThis.addEventListener('resize', handleResize, { passive: true });
    return () => {
      delete document.documentElement.dataset.paperPreview;
      globalThis.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    const processLatest = async (): Promise<void> => {
      if (processing.current || disposed) return;
      processing.current = true;
      try {
        while (!disposed) {
          const snapshot = latestSnapshot.current;
          if (!snapshot || snapshot.revisionId === currentRevisionId.current) break;
          const abortController = new AbortController();
          activeAbortController.current = abortController;
          setStatus(currentPagination.current ? '正在更新分页...' : '正在分页...');
          applyPaperTheme(document, snapshot.preferences);
          try {
            const pagination = await paginateFinishedDocument({
              document,
              html: snapshot.html,
              signal: abortController.signal,
            });
            if (
              disposed ||
              abortController.signal.aborted ||
              latestSnapshot.current?.revisionId !== snapshot.revisionId
            ) {
              pagination.cleanup();
              continue;
            }

            const previousController = currentController.current;
            const previousPagination = currentPagination.current;
            viewport.current?.replaceChildren(pagination.element);
            const controller = bindFinishedDocument(document, {
              copyText: async (text) => postToHost({ text, type: 'copy-text' }),
              initialReadingPosition: snapshot.initialReadingPosition,
              onActiveHeadingChange: (activeHeadingId) => {
                const active = currentController.current;
                if (!active) return;
                postToHost({
                  ...(activeHeadingId ? { activeHeadingId } : {}),
                  followState: active.getViewportFollowState(),
                  position: active.getReadingPosition(),
                  type: 'reading-position',
                });
              },
              onFindRequest: () => postToHost({ type: 'find-request' }),
              onFocusRenderedVisual: (visual) =>
                postToHost({ action: 'focus', type: 'visual-action', visual }),
              onInspectRenderedVisual: (visual) =>
                postToHost({ action: 'source', type: 'visual-action', visual }),
              onReadingPositionChange: (position) => {
                const active = currentController.current;
                postToHost({
                  followState: active?.getViewportFollowState() ?? {
                    distanceFromEnd: 0,
                    hasSelection: false,
                  },
                  position,
                  type: 'reading-position',
                });
              },
              revisionId: `paper:${snapshot.revisionId}`,
              staticSnapshot: true,
            });
            currentController.current = controller;
            currentPagination.current = pagination;
            currentRevisionId.current = snapshot.revisionId;
            previousController?.destroy();
            previousPagination?.cleanup();
            await new Promise<void>((resolve) =>
              globalThis.requestAnimationFrame(() =>
                globalThis.requestAnimationFrame(() => resolve()),
              ),
            );
            const position = controller.getReadingPosition();
            setStatus('');
            postToHost({
              pageCount: pagination.pageCount,
              position,
              revisionId: snapshot.revisionId,
              type: 'ready',
            });
          } catch (error) {
            if (abortController.signal.aborted) continue;
            console.error('Paper preview pagination failed', error);
            const message = error instanceof Error ? error.message : '纸张分页失败。';
            setStatus(message);
            postToHost({ message, revisionId: snapshot.revisionId, type: 'failed' });
            currentRevisionId.current = snapshot.revisionId;
          }
        }
      } finally {
        processing.current = false;
        if (
          !disposed &&
          latestSnapshot.current &&
          latestSnapshot.current.revisionId !== currentRevisionId.current
        ) {
          void processLatest();
        }
      }
    };

    const handleMessage = (event: MessageEvent<unknown>): void => {
      if (event.source !== globalThis.parent || !isPaperPreviewHostMessage(event.data, channelId))
        return;
      const message: PaperPreviewHostMessage = event.data;
      if (message.type === 'render') {
        latestSnapshot.current = message.snapshot;
        activeAbortController.current?.abort();
        void processLatest();
        return;
      }
      const controller = currentController.current;
      if (!controller || message.type !== 'command') return;
      if (message.command === 'clear-find') {
        postToHost({ findResult: controller.clearFind(), type: 'find-result' });
      } else if (message.command === 'find') {
        postToHost({ findResult: controller.find(message.query), type: 'find-result' });
      } else if (message.command === 'find-next') {
        postToHost({ findResult: controller.findNext(), type: 'find-result' });
      } else if (message.command === 'find-previous') {
        postToHost({ findResult: controller.findPrevious(), type: 'find-result' });
      } else if (message.command === 'focus-visual-action') {
        controller.focusRenderedVisualAction(message.id, message.action);
      } else if (message.command === 'locate-visual') {
        controller.locateRenderedVisual(message.id);
      } else if (message.command === 'restore-reading-position') {
        controller.restoreReadingPosition(message.position);
      } else if (message.command === 'scroll-to-end') {
        controller.scrollToEnd();
      } else if (message.command === 'scroll-to-heading') {
        controller.scrollToHeading(message.id);
      }
    };

    globalThis.addEventListener('message', handleMessage);
    postToHost({ type: 'mounted' });
    return () => {
      disposed = true;
      activeAbortController.current?.abort();
      currentController.current?.destroy();
      currentPagination.current?.cleanup();
      globalThis.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <>
      <style data-pagedjs-ignore="true" media="screen">
        {documentThemeCss}
      </style>
      <style data-pagedjs-ignore="true">{paperPagedMediaCss}</style>
      <style data-pagedjs-ignore="true">{paperRuntimeCss}</style>
      <main aria-label="纸张预览页面" className="paper-preview-viewport" ref={viewport} />
      <div aria-live="polite" className="paper-preview-status" hidden={!status}>
        {status}
      </div>
    </>
  );
}
