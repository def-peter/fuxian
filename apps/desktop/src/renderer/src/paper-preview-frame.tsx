import type { RenderRevisionSnapshot } from '@fuxian/render-protocol';
import type { ReadingPosition } from '@fuxian/shared-types';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import type {
  FindResult,
  FinishedDocumentController,
  RenderedVisualSnapshot,
} from './finished-document';
import {
  isPaperPreviewFrameMessage,
  type PaperPreviewHostMessage,
  type PaperPreviewHostPayload,
  type PaperPreviewSnapshot,
} from './paper-preview-protocol';

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });
const emptyRenderSnapshot = (revisionId: string): RenderRevisionSnapshot => ({
  readiness: {
    cancelled: 0,
    complete: true,
    failed: 0,
    pending: 0,
    succeeded: 0,
    timedOut: 0,
    total: 0,
  },
  revisionId,
  tasks: [],
});

interface PaperPreviewFrameProps {
  className?: string;
  onActiveHeadingChange(id: string | undefined): void;
  onControllerChange(controller: FinishedDocumentController | undefined): void;
  onFailure(message: string): void;
  onFindRequest(): void;
  onFindResult(result: FindResult): void;
  onFocusRenderedVisual(visual: RenderedVisualSnapshot): void;
  onInspectRenderedVisual(visual: RenderedVisualSnapshot): void;
  onReady(pageCount: number, revisionId: string): void;
  onReadingPositionChange(position: ReadingPosition): void;
  snapshot: PaperPreviewSnapshot;
}

export function PaperPreviewFrame({
  className,
  onActiveHeadingChange,
  onControllerChange,
  onFailure,
  onFindRequest,
  onFindResult,
  onFocusRenderedVisual,
  onInspectRenderedVisual,
  onReady,
  onReadingPositionChange,
  snapshot,
}: PaperPreviewFrameProps): React.JSX.Element {
  const iframe = useRef<HTMLIFrameElement>(null);
  const snapshotRef = useRef(snapshot);
  const positionRef = useRef(snapshot.initialReadingPosition);
  const followStateRef = useRef({ distanceFromEnd: 0, hasSelection: false });
  const findResultRef = useRef(emptyFindResult());
  const callbacksRef = useRef({
    onActiveHeadingChange,
    onControllerChange,
    onFailure,
    onFindRequest,
    onFindResult,
    onFocusRenderedVisual,
    onInspectRenderedVisual,
    onReady,
    onReadingPositionChange,
  });
  const channelId = useMemo(() => crypto.randomUUID(), []);
  const sourceUrl = useMemo(() => {
    const url = new URL(globalThis.location.href);
    const systemLocale = url.searchParams.get('systemLocale');
    url.search = '';
    if (systemLocale) url.searchParams.set('systemLocale', systemLocale);
    url.hash = '';
    url.searchParams.set('channelId', channelId);
    url.searchParams.set('view', 'paper-preview');
    return url.href;
  }, [channelId]);

  const post = useCallback(
    (message: PaperPreviewHostPayload): void => {
      iframe.current?.contentWindow?.postMessage(
        { ...message, channelId, scope: 'fuxian-paper-preview' } as PaperPreviewHostMessage,
        '*',
      );
    },
    [channelId],
  );

  useEffect(() => {
    callbacksRef.current = {
      onActiveHeadingChange,
      onControllerChange,
      onFailure,
      onFindRequest,
      onFindResult,
      onFocusRenderedVisual,
      onInspectRenderedVisual,
      onReady,
      onReadingPositionChange,
    };
  }, [
    onActiveHeadingChange,
    onControllerChange,
    onFailure,
    onFindRequest,
    onFindResult,
    onFocusRenderedVisual,
    onInspectRenderedVisual,
    onReady,
    onReadingPositionChange,
  ]);

  const controller = useMemo<FinishedDocumentController>(
    () => ({
      applyPlantUmlServer: () => undefined,
      applyTheme: () => undefined,
      clearFind: () => {
        post({ command: 'clear-find', type: 'command' });
        findResultRef.current = emptyFindResult();
        return findResultRef.current;
      },
      destroy: () => undefined,
      find: (query) => {
        post({ command: 'find', query, type: 'command' });
        return findResultRef.current;
      },
      findNext: () => {
        post({ command: 'find-next', type: 'command' });
        return findResultRef.current;
      },
      findPrevious: () => {
        post({ command: 'find-previous', type: 'command' });
        return findResultRef.current;
      },
      focusRenderedVisualAction: (id, action) =>
        post({ action, command: 'focus-visual-action', id, type: 'command' }),
      getRenderedVisualSnapshots: () => [],
      getReadingPosition: () => positionRef.current,
      getRenderSnapshot: () => emptyRenderSnapshot(`paper:${snapshotRef.current.revisionId}`),
      getStaticSnapshotHtml: () => snapshotRef.current.html,
      getViewportFollowState: () => followStateRef.current,
      locateRenderedVisual: (id) => {
        post({ command: 'locate-visual', id, type: 'command' });
        return true;
      },
      restoreReadingPosition: (position) => {
        positionRef.current = position;
        post({ command: 'restore-reading-position', position, type: 'command' });
      },
      scrollToEnd: () => {
        post({ command: 'scroll-to-end', type: 'command' });
        return positionRef.current;
      },
      scrollToHeading: (id) => post({ command: 'scroll-to-heading', id, type: 'command' }),
      whenRenderReady: () => Promise.resolve(emptyRenderSnapshot(snapshotRef.current.revisionId)),
      whenRenderTaskKindsReady: () =>
        Promise.resolve(emptyRenderSnapshot(snapshotRef.current.revisionId)),
    }),
    [post],
  );

  useEffect(() => {
    snapshotRef.current = snapshot;
    positionRef.current = snapshot.initialReadingPosition;
    post({ snapshot, type: 'render' });
  }, [post, snapshot]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.source !== iframe.current?.contentWindow ||
        !isPaperPreviewFrameMessage(event.data, channelId)
      )
        return;
      const message = event.data;
      const callbacks = callbacksRef.current;
      if (message.type === 'mounted') {
        post({ snapshot: snapshotRef.current, type: 'render' });
      } else if (message.type === 'copy-text') {
        void window.fuxian.copyText(message.text);
      } else if (message.type === 'ready') {
        positionRef.current = message.position;
        callbacks.onControllerChange(controller);
        callbacks.onActiveHeadingChange(message.position.headingId);
        callbacks.onReadingPositionChange(message.position);
        callbacks.onReady(message.pageCount, message.revisionId);
      } else if (message.type === 'failed') {
        callbacks.onFailure(message.message);
      } else if (message.type === 'find-result') {
        findResultRef.current = message.findResult;
        callbacks.onFindResult(message.findResult);
      } else if (message.type === 'find-request') {
        callbacks.onFindRequest();
      } else if (message.type === 'reading-position') {
        positionRef.current = message.position;
        followStateRef.current = message.followState;
        if (message.activeHeadingId !== undefined) {
          callbacks.onActiveHeadingChange(message.activeHeadingId ?? undefined);
        }
        callbacks.onReadingPositionChange(message.position);
      } else if (message.type === 'visual-action') {
        if (message.action === 'source') callbacks.onInspectRenderedVisual(message.visual);
        else callbacks.onFocusRenderedVisual(message.visual);
      }
    };
    globalThis.addEventListener('message', handleMessage);
    return () => {
      callbacksRef.current.onControllerChange(undefined);
      globalThis.removeEventListener('message', handleMessage);
    };
  }, [channelId, controller, post]);

  return (
    <iframe
      className={cn('block size-full min-h-0 min-w-0 border-0 bg-transparent', className)}
      ref={iframe}
      src={sourceUrl}
      title="纸张预览"
    />
  );
}
