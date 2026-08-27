import { renderMarkdown } from '@fuxian/markdown-renderer';
import type {
  ExternalRevisionEvent,
  OpenSourceDocumentsResult,
  ReadingPosition,
  ReadSourceDocumentResult,
  SourceDocumentData,
} from '@fuxian/shared-types';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  RefreshCw,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContentOutline, type ContentOutlinePreference } from '@/content-outline';
import {
  activateDocument,
  addDocumentsToSession,
  applyFinishedDocumentRevision,
  closeDocument,
  createDocumentSession,
  createPersistedDocumentSession,
  createRestoredDocumentSession,
  recoverUnavailableDocument,
  removeUnavailableDocument,
  reopenRecentDocument,
  setUnavailableDocumentMessage,
  updateReadingPosition,
  type FinishedSourceDocument,
  type SessionDocument,
} from '@/document-session';
import { DocumentSessionSidebar } from '@/document-session-sidebar';
import { DocumentWidthPopover } from '@/document-width-controls';
import { createDesktopPlantUmlRenderer } from '@/document-render-adapter';
import { DiagramFocusDialog, DiagramSourceDrawer } from '@/diagram-inspection';
import {
  getRenderRevisionFailure,
  waitForFinishedDocumentResources,
  type ExternalRevisionStatus,
} from '@/external-revision';
import {
  bindFinishedDocument,
  createFinishedDocumentSource,
  type DiagramSnapshot,
  type FindResult,
  type FinishedDocumentController,
} from '@/finished-document';
import { FuxianMark } from '@/fuxian-mark';
import { cn } from '@/lib/utils';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';
import { useReaderPreferences } from '@/use-reader-preferences';

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });
const renderPlantUml = createDesktopPlantUmlRenderer(window.fuxian);
let externalFrameRevision = 0;

interface FinishedDocumentFrameRevision {
  document: FinishedSourceDocument;
  id: string;
  readingPosition: ReadingPosition;
  staging: boolean;
}

interface FinishedDocumentFrameProps {
  draggingFiles: boolean;
  frame: FinishedDocumentFrameRevision;
  onLoad(frame: FinishedDocumentFrameRevision, element: HTMLIFrameElement): void;
  onRemove(id: string): void;
  visible: boolean;
}

function FinishedDocumentFrame({
  draggingFiles,
  frame,
  onLoad,
  onRemove,
  visible,
}: FinishedDocumentFrameProps): React.JSX.Element {
  const element = useRef<HTMLIFrameElement>(null);
  useEffect(() => () => onRemove(frame.id), [frame.id, onRemove]);

  return (
    <iframe
      aria-hidden={!visible}
      className={cn(
        'col-start-1 row-start-1 block size-full min-h-0 min-w-0 border bg-card',
        visible ? 'visible z-10' : 'invisible pointer-events-none',
        draggingFiles && 'pointer-events-none',
      )}
      data-frame-revision={frame.id}
      onLoad={() => element.current && onLoad(frame, element.current)}
      ref={element}
      sandbox="allow-popups allow-same-origin"
      srcDoc={createFinishedDocumentSource(frame.document.html)}
      tabIndex={visible ? 0 : -1}
      title={visible ? 'Finished document' : 'Preparing finished document'}
    />
  );
}

const finishSourceDocument = (document: SourceDocumentData): FinishedSourceDocument => {
  const finishedDocument = renderMarkdown({
    resourceBaseUrl: document.resourceBaseUrl,
    source: document.source,
  });

  return {
    document,
    headings: finishedDocument.headings,
    html: finishedDocument.html,
    resourceUrls: finishedDocument.resources.flatMap((resource) =>
      resource.status === 'resolved' ? [resource.url] : [],
    ),
  };
};

export function App(): React.JSX.Element {
  const { preferences, resolvedAppearance, updatePreferences } = useReaderPreferences();
  const [session, setSession] = useState(createDocumentSession);
  const [restorationStatus, setRestorationStatus] = useState<'loading' | 'ready'>('loading');
  const [opening, setOpening] = useState(false);
  const [blockingError, setBlockingError] = useState<string>();
  const [showAllStartRecent, setShowAllStartRecent] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [outlinePreference, setOutlinePreference] = useState<ContentOutlinePreference>('expanded');
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState<FindResult>(emptyFindResult);
  const [sourceDiagram, setSourceDiagram] = useState<DiagramSnapshot>();
  const [focusedDiagram, setFocusedDiagram] = useState<DiagramSnapshot>();
  const [promotedRevision, setPromotedRevision] = useState<FinishedDocumentFrameRevision>();
  const [pendingRevision, setPendingRevision] = useState<FinishedDocumentFrameRevision>();
  const [externalRevisionStatus, setExternalRevisionStatus] = useState<ExternalRevisionStatus>({
    state: 'idle',
  });
  const finishedDocumentController = useRef<FinishedDocumentController | undefined>(undefined);
  const frameControllers = useRef(new Map<string, FinishedDocumentController>());
  const findInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const sessionRef = useRef(session);
  const diagramLayoutReadingPosition = useRef<ReadingPosition | undefined>(undefined);
  const pendingRevisionRef = useRef<FinishedDocumentFrameRevision | undefined>(undefined);
  const visibleFrameIdRef = useRef<string | undefined>(undefined);
  const updatedStatusTimer = useRef<number | undefined>(undefined);

  const activeDocument = session.openDocuments.find(
    (document): document is SessionDocument =>
      document.status === 'available' && document.document.path === session.activeDocumentPath,
  );
  const sessionFrame = activeDocument
    ? {
        document: activeDocument,
        id: `session:${activeDocument.document.path}`,
        readingPosition: activeDocument.readingPosition,
        staging: false,
      }
    : undefined;
  const visibleFrame =
    promotedRevision?.document.document.path === activeDocument?.document.path
      ? promotedRevision
      : sessionFrame;

  const beginExternalRevision = useCallback((event: ExternalRevisionEvent): void => {
    const active = sessionRef.current.openDocuments.find(
      (item): item is SessionDocument =>
        item.status === 'available' && item.document.path === event.path,
    );
    if (!active || sessionRef.current.activeDocumentPath !== event.path) return;
    if (updatedStatusTimer.current) window.clearTimeout(updatedStatusTimer.current);
    setExternalRevisionStatus({ state: 'updating' });

    if (event.result.status === 'unavailable') {
      pendingRevisionRef.current = undefined;
      setPendingRevision(undefined);
      setExternalRevisionStatus({ detail: event.result.message, state: 'failed' });
      return;
    }

    try {
      const document = finishSourceDocument(event.result.document);
      const frame: FinishedDocumentFrameRevision = {
        document,
        id: `external:${event.path}:${++externalFrameRevision}`,
        readingPosition:
          finishedDocumentController.current?.getReadingPosition() ?? active.readingPosition,
        staging: true,
      };
      pendingRevisionRef.current = frame;
      setPendingRevision(frame);
    } catch (error) {
      pendingRevisionRef.current = undefined;
      setPendingRevision(undefined);
      setExternalRevisionStatus({
        detail: error instanceof Error ? error.message : '新版本 Markdown 无法解析。',
        state: 'failed',
      });
    }
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    visibleFrameIdRef.current = visibleFrame?.id;
  }, [visibleFrame?.id]);

  useEffect(() => window.fuxian.onExternalRevision(beginExternalRevision), [beginExternalRevision]);

  const activeResourceUrls = activeDocument?.resourceUrls.join('\n') ?? '';
  useEffect(() => {
    const path = activeDocument?.document.path;
    void window.fuxian
      .configureActiveDocumentWatch({
        ...(path ? { path } : {}),
        resourceUrls: activeResourceUrls ? activeResourceUrls.split('\n') : [],
      })
      .catch(() => undefined);
    return () => {
      void window.fuxian.configureActiveDocumentWatch({ resourceUrls: [] }).catch(() => undefined);
    };
  }, [activeDocument?.document.path, activeResourceUrls]);

  useEffect(() => {
    let cancelled = false;
    void window.fuxian
      .loadDocumentSession()
      .then((result) => {
        if (cancelled) {
          return;
        }
        const restored = result.openDocuments.map((item) => {
          if (item.status === 'unavailable') {
            return item;
          }
          try {
            return {
              status: 'available' as const,
              reference: item.reference,
              document: finishSourceDocument(item.document),
            };
          } catch {
            return {
              status: 'unavailable' as const,
              reference: item.reference,
              message: `“${item.reference.name}”的内容暂时无法呈现。`,
            };
          }
        });
        setSession(createRestoredDocumentSession(result.session, restored, Date.now()));
      })
      .catch(() => {
        if (!cancelled) {
          setBlockingError('无法恢复上次文档会话。你仍可以重新打开文档。');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRestorationStatus('ready');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (restorationStatus !== 'ready') {
      return;
    }
    const saveTimer = window.setTimeout(() => {
      void window.fuxian.saveDocumentSession(createPersistedDocumentSession(session));
    }, 150);
    return () => window.clearTimeout(saveTimer);
  }, [restorationStatus, session]);

  useEffect(() => {
    const saveBeforeUnload = (): void => {
      void window.fuxian.saveDocumentSession(createPersistedDocumentSession(sessionRef.current));
    };
    window.addEventListener('beforeunload', saveBeforeUnload);
    return () => window.removeEventListener('beforeunload', saveBeforeUnload);
  }, []);

  useEffect(() => {
    const controllers = frameControllers.current;
    return () => {
      for (const controller of controllers.values()) controller.destroy();
      controllers.clear();
      if (updatedStatusTimer.current) window.clearTimeout(updatedStatusTimer.current);
    };
  }, []);

  useEffect(() => {
    for (const controller of frameControllers.current.values()) {
      controller.applyTheme(toDocumentThemePreferences(preferences, resolvedAppearance));
    }
  }, [preferences, resolvedAppearance]);

  useEffect(() => {
    for (const controller of frameControllers.current.values()) {
      controller.applyPlantUmlServer(preferences.plantUml.serverUrl);
    }
  }, [preferences.plantUml.serverUrl]);

  useEffect(() => {
    for (const controller of frameControllers.current.values()) {
      controller.applyDiagramOptimization(preferences.diagram.optimize);
    }
  }, [preferences.diagram.optimize]);

  useEffect(() => {
    const position = diagramLayoutReadingPosition.current;
    if (!position) return;
    const frame = window.requestAnimationFrame(() => {
      finishedDocumentController.current?.restoreReadingPosition(position);
      diagramLayoutReadingPosition.current = undefined;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [sourceDiagram]);

  useEffect(() => {
    const controller = finishedDocumentController.current;
    setFindResult(
      findOpen ? (controller?.find(findQuery) ?? emptyFindResult()) : emptyFindResult(),
    );
    if (!findOpen) {
      controller?.clearFind();
    }
  }, [findOpen, findQuery]);

  useEffect(() => {
    if (findOpen) {
      findInput.current?.focus();
    }
  }, [findOpen]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (
        activeDocument &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault();
        setFindOpen(true);
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [activeDocument]);

  const resetDocumentControls = (): void => {
    for (const controller of frameControllers.current.values()) controller.destroy();
    frameControllers.current.clear();
    finishedDocumentController.current = undefined;
    visibleFrameIdRef.current = undefined;
    pendingRevisionRef.current = undefined;
    setPendingRevision(undefined);
    setPromotedRevision(undefined);
    if (updatedStatusTimer.current) window.clearTimeout(updatedStatusTimer.current);
    setExternalRevisionStatus({ state: 'idle' });
    setActiveHeadingId(undefined);
    setFindOpen(false);
    setFindQuery('');
    setFindResult(emptyFindResult());
    setSourceDiagram(undefined);
    setFocusedDiagram(undefined);
  };

  const showDiagramSource = (diagram: DiagramSnapshot | undefined): void => {
    diagramLayoutReadingPosition.current = finishedDocumentController.current?.getReadingPosition();
    setSourceDiagram(diagram);
  };

  const handleFinishedDocumentFrameRemove = useCallback((id: string): void => {
    const controller = frameControllers.current.get(id);
    controller?.destroy();
    frameControllers.current.delete(id);
    if (finishedDocumentController.current === controller) {
      finishedDocumentController.current = undefined;
    }
  }, []);

  const handleFinishedDocumentLoad = (
    frame: FinishedDocumentFrameRevision,
    element: HTMLIFrameElement,
  ): void => {
    frameControllers.current.get(frame.id)?.destroy();
    const frameDocument = element.contentDocument;
    if (!frameDocument) return;
    const controller = bindFinishedDocument(frameDocument, {
      copyText: window.fuxian.copyText,
      initialAppearance: resolvedAppearance,
      initialDiagramOptimization: preferences.diagram.optimize,
      initialPlantUmlServerUrl: preferences.plantUml.serverUrl,
      initialReadingPosition: frame.readingPosition,
      onActiveHeadingChange: (id) => {
        if (visibleFrameIdRef.current === frame.id) setActiveHeadingId(id);
      },
      onFindRequest: () => {
        if (visibleFrameIdRef.current === frame.id) setFindOpen(true);
      },
      onFocusDiagram: (diagram) => {
        if (visibleFrameIdRef.current === frame.id) setFocusedDiagram(diagram);
      },
      onInspectDiagram: (diagram) => {
        if (visibleFrameIdRef.current === frame.id) showDiagramSource(diagram);
      },
      onReadingPositionChange: (position) => {
        if (visibleFrameIdRef.current === frame.id) {
          setSession((current) =>
            updateReadingPosition(current, frame.document.document.path, position),
          );
        }
      },
      revisionId: frame.id,
      renderPlantUml,
    });
    controller.applyTheme(toDocumentThemePreferences(preferences, resolvedAppearance));
    frameControllers.current.set(frame.id, controller);

    if (!frame.staging && visibleFrameIdRef.current === frame.id) {
      finishedDocumentController.current = controller;
      setFindResult(findOpen ? controller.find(findQuery) : emptyFindResult());
      return;
    }

    if (!frame.staging) return;
    void Promise.all([
      controller.whenRenderReady(),
      waitForFinishedDocumentResources(frameDocument),
    ])
      .then(([snapshot]) => {
        if (pendingRevisionRef.current?.id !== frame.id) return;
        const failure = getRenderRevisionFailure(snapshot);
        if (failure) throw new Error(failure);

        const oldVisibleFrameId = visibleFrameIdRef.current;
        visibleFrameIdRef.current = frame.id;
        pendingRevisionRef.current = undefined;
        finishedDocumentController.current = controller;
        setPromotedRevision({ ...frame, staging: false });
        setPendingRevision(undefined);
        setSession((current) =>
          applyFinishedDocumentRevision(
            current,
            frame.document.document.path,
            frame.document,
            frame.readingPosition,
          ),
        );
        setActiveHeadingId(frame.readingPosition.headingId ?? frame.document.headings[0]?.id);
        setFindResult(findOpen ? controller.find(findQuery) : emptyFindResult());
        const time = new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          hour12: false,
          minute: '2-digit',
        }).format(new Date());
        setExternalRevisionStatus({ state: 'updated', time });
        updatedStatusTimer.current = window.setTimeout(
          () => setExternalRevisionStatus({ state: 'idle' }),
          5_000,
        );

        if (oldVisibleFrameId && oldVisibleFrameId !== frame.id) {
          frameControllers.current.get(oldVisibleFrameId)?.destroy();
          frameControllers.current.delete(oldVisibleFrameId);
        }
      })
      .catch((error: unknown) => {
        if (pendingRevisionRef.current?.id !== frame.id) return;
        pendingRevisionRef.current = undefined;
        setPendingRevision(undefined);
        setExternalRevisionStatus({
          detail: error instanceof Error ? error.message : '新版本无法完整呈现。',
          state: 'failed',
        });
      });
  };

  const acceptOpenResult = (result: OpenSourceDocumentsResult): void => {
    if (result.status === 'cancelled') {
      setOpening(false);
      return;
    }

    if (result.status === 'error') {
      setOpening(false);
      if (!activeDocument) {
        setBlockingError(result.message);
      }
      return;
    }

    const finishedDocuments: FinishedSourceDocument[] = [];
    for (const document of result.documents) {
      try {
        finishedDocuments.push(finishSourceDocument(document));
      } catch {
        // A malformed document does not block other selected documents.
      }
    }

    setOpening(false);
    if (finishedDocuments.length === 0) {
      if (!activeDocument) {
        setBlockingError('选择的文档暂时无法呈现。请检查文件内容后重试。');
      }
      return;
    }

    const switchingDocument = finishedDocuments[0]?.document.path !== session.activeDocumentPath;
    const currentPath = switchingDocument ? session.activeDocumentPath : undefined;
    const currentPosition = switchingDocument
      ? finishedDocumentController.current?.getReadingPosition()
      : undefined;
    if (switchingDocument) {
      resetDocumentControls();
    }
    setBlockingError(undefined);
    setSession((current) =>
      addDocumentsToSession(
        currentPath && currentPosition
          ? updateReadingPosition(current, currentPath, currentPosition)
          : current,
        finishedDocuments,
        Date.now(),
      ),
    );
  };

  const openSourceDocuments = async (): Promise<void> => {
    setOpening(true);
    try {
      acceptOpenResult(await window.fuxian.openSourceDocuments());
    } catch {
      setOpening(false);
      if (!activeDocument) {
        setBlockingError('应用暂时无法访问文件。请重试或重新打开窗口。');
      }
    }
  };

  const openDroppedSourceDocuments = async (files: File[]): Promise<void> => {
    setOpening(true);
    try {
      acceptOpenResult(await window.fuxian.openDroppedSourceDocuments(files));
    } catch {
      setOpening(false);
      if (!activeDocument) {
        setBlockingError('应用无法读取拖入的文档。请确认文件仍然存在。');
      }
    }
  };

  const activateOpenDocument = (path: string): void => {
    if (path !== session.activeDocumentPath) {
      const currentPath = session.activeDocumentPath;
      const position = finishedDocumentController.current?.getReadingPosition();
      resetDocumentControls();
      setSession((current) =>
        activateDocument(
          currentPath && position ? updateReadingPosition(current, currentPath, position) : current,
          path,
        ),
      );
    }
  };

  const closeOpenDocument = (path: string): void => {
    const position =
      path === session.activeDocumentPath
        ? finishedDocumentController.current?.getReadingPosition()
        : undefined;
    if (path === session.activeDocumentPath) {
      resetDocumentControls();
    }
    setSession((current) =>
      closeDocument(
        position ? updateReadingPosition(current, path, position) : current,
        path,
        Date.now(),
      ),
    );
  };

  const reopenDocument = async (path: string): Promise<void> => {
    setOpening(true);
    try {
      const result = await window.fuxian.retrySourceDocument(path);
      if (result.status === 'available') {
        const document = finishSourceDocument(result.document);
        const currentPath = session.activeDocumentPath;
        const currentPosition = finishedDocumentController.current?.getReadingPosition();
        resetDocumentControls();
        setBlockingError(undefined);
        setSession((current) =>
          reopenRecentDocument(
            currentPath && currentPosition
              ? updateReadingPosition(current, currentPath, currentPosition)
              : current,
            path,
            document,
            Date.now(),
          ),
        );
      } else {
        setSession((current) => reopenRecentDocument(current, path, result, Date.now()));
      }
    } catch {
      setSession((current) =>
        reopenRecentDocument(current, path, { message: '应用暂时无法访问该文档。' }, Date.now()),
      );
    } finally {
      setOpening(false);
    }
  };

  const acceptRecoveryResult = (path: string, result: ReadSourceDocumentResult): void => {
    if (result.status === 'unavailable') {
      setSession((current) => setUnavailableDocumentMessage(current, path, result.message));
      return;
    }
    try {
      const document = finishSourceDocument(result.document);
      setSession((current) => recoverUnavailableDocument(current, path, document));
      setBlockingError(undefined);
    } catch {
      setSession((current) =>
        setUnavailableDocumentMessage(current, path, '该文档的内容暂时无法呈现。'),
      );
    }
  };

  const retryUnavailableDocument = async (path: string): Promise<void> => {
    setOpening(true);
    try {
      acceptRecoveryResult(path, await window.fuxian.retrySourceDocument(path));
    } catch {
      setSession((current) =>
        setUnavailableDocumentMessage(current, path, '应用暂时无法访问该文档。'),
      );
    } finally {
      setOpening(false);
    }
  };

  const locateUnavailableDocument = async (path: string): Promise<void> => {
    setOpening(true);
    try {
      const result = await window.fuxian.locateSourceDocument(path);
      if (result.status !== 'cancelled') {
        acceptRecoveryResult(path, result);
      }
    } finally {
      setOpening(false);
    }
  };

  const retryExternalRevision = async (): Promise<void> => {
    const path = sessionRef.current.activeDocumentPath;
    if (!path) return;
    if (updatedStatusTimer.current) window.clearTimeout(updatedStatusTimer.current);
    setExternalRevisionStatus({ state: 'updating' });
    try {
      beginExternalRevision({
        path,
        result: await window.fuxian.retrySourceDocument(path),
        revision: 0,
      });
    } catch {
      setExternalRevisionStatus({
        detail: '应用暂时无法重新读取源文档。',
        state: 'failed',
      });
    }
  };

  const closeFind = (): void => {
    finishedDocumentController.current?.clearFind();
    setFindOpen(false);
    setFindQuery('');
    setFindResult(emptyFindResult());
  };

  const showNextFindResult = (): void => {
    setFindResult(finishedDocumentController.current?.findNext() ?? emptyFindResult());
  };

  const showPreviousFindResult = (): void => {
    setFindResult(finishedDocumentController.current?.findPrevious() ?? emptyFindResult());
  };

  const handleFindKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeFind();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (event.shiftKey) {
        showPreviousFindResult();
      } else {
        showNextFindResult();
      }
    }
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>): void => {
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    dragDepth.current += 1;
    setDraggingFiles(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDraggingFiles(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>): void => {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    dragDepth.current = 0;
    setDraggingFiles(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      void openDroppedSourceDocuments(files);
    }
  };

  const startRecentDocuments = showAllStartRecent
    ? session.recentDocuments
    : session.recentDocuments.slice(0, 5);
  const unavailableDocuments = session.openDocuments.filter(
    (document) => document.status === 'unavailable',
  );
  const documentFrames = visibleFrame
    ? pendingRevision
      ? [visibleFrame, pendingRevision]
      : [visibleFrame]
    : [];

  return (
    <TooltipProvider>
      <div
        className="relative grid h-full grid-cols-[216px_minmax(0,1fr)] bg-background"
        data-session-root=""
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <DocumentSessionSidebar
          activeDocumentPath={session.activeDocumentPath}
          isOpening={opening}
          onActivate={activateOpenDocument}
          onClose={closeOpenDocument}
          onLocate={(path) => void locateUnavailableDocument(path)}
          onOpen={() => void openSourceDocuments()}
          onOpenSettings={() => void window.fuxian.openSettings()}
          onRemoveUnavailable={(path) =>
            setSession((current) => removeUnavailableDocument(current, path))
          }
          onReopen={(path) => void reopenDocument(path)}
          onRetry={(path) => void retryUnavailableDocument(path)}
          openDocuments={session.openDocuments}
          recentDocuments={session.recentDocuments}
        />

        {restorationStatus === 'loading' ? (
          <main className="flex min-h-0 items-center justify-center text-sm text-muted-foreground">
            正在恢复上次会话...
          </main>
        ) : activeDocument && visibleFrame ? (
          <div className="grid min-h-0 grid-rows-[44px_minmax(0,1fr)]">
            <header className="flex items-center justify-between border-b bg-card px-4">
              <div className="flex min-w-0 items-center gap-1.5">
                <Button
                  aria-label={outlinePreference === 'expanded' ? '折叠内容目录' : '展开内容目录'}
                  onClick={() =>
                    setOutlinePreference((current) =>
                      current === 'expanded' ? 'collapsed' : 'expanded',
                    )
                  }
                  size="icon-sm"
                  title={outlinePreference === 'expanded' ? '折叠内容目录' : '展开内容目录'}
                  variant="ghost"
                >
                  {outlinePreference === 'expanded' ? (
                    <PanelRightClose aria-hidden="true" />
                  ) : (
                    <PanelRightOpen aria-hidden="true" />
                  )}
                </Button>
                <FileText aria-hidden="true" className="ml-1 size-4 text-muted-foreground" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="truncate text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      tabIndex={0}
                    >
                      {activeDocument.document.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-96 break-all" side="bottom" sideOffset={8}>
                    {activeDocument.document.path}
                  </TooltipContent>
                </Tooltip>
                {externalRevisionStatus.state === 'updating' ? (
                  <span
                    aria-live="polite"
                    className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                  >
                    <Spinner aria-hidden="true" />
                    正在更新...
                  </span>
                ) : null}
                {externalRevisionStatus.state === 'updated' ? (
                  <span
                    aria-live="polite"
                    className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                  >
                    <CheckCircle2 aria-hidden="true" className="size-3.5 text-primary" />
                    已更新 · {externalRevisionStatus.time}
                  </span>
                ) : null}
                {externalRevisionStatus.state === 'failed' ? (
                  <div
                    aria-live="assertive"
                    className="ml-2 flex shrink-0 items-center gap-1 text-xs text-destructive"
                  >
                    <AlertCircle aria-hidden="true" className="size-3.5" />
                    <span>更新失败</span>
                    <Button
                      aria-label="重试文档更新"
                      onClick={() => void retryExternalRevision()}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <RefreshCw aria-hidden="true" data-icon="inline-start" />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="xs" variant="ghost">
                          详情
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-80">
                        <PopoverHeader>
                          <PopoverTitle>文档更新失败</PopoverTitle>
                          <PopoverDescription className="break-words">
                            正在显示上一版本。{externalRevisionStatus.detail}
                          </PopoverDescription>
                        </PopoverHeader>
                      </PopoverContent>
                    </Popover>
                  </div>
                ) : null}
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-1">
                <DocumentWidthPopover
                  onChange={(documentWidth) => updatePreferences({ ...preferences, documentWidth })}
                  value={preferences.documentWidth}
                />
                {findOpen ? (
                  <div className="flex h-8 items-center rounded-md border bg-background pl-2 shadow-xs">
                    <Search aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                    <input
                      aria-label="页内查找"
                      className="h-7 w-48 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                      onChange={(event) => setFindQuery(event.target.value)}
                      onKeyDown={handleFindKeyDown}
                      placeholder="查找"
                      ref={findInput}
                      type="text"
                      value={findQuery}
                    />
                    <span
                      aria-live="polite"
                      className="min-w-12 px-1 text-center text-xs tabular-nums text-muted-foreground"
                    >
                      {findResult.current}/{findResult.total}
                    </span>
                    <Button
                      aria-label="上一个匹配项"
                      disabled={findResult.total === 0}
                      onClick={showPreviousFindResult}
                      size="icon-xs"
                      title="上一个匹配项"
                      variant="ghost"
                    >
                      <ChevronUp aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label="下一个匹配项"
                      disabled={findResult.total === 0}
                      onClick={showNextFindResult}
                      size="icon-xs"
                      title="下一个匹配项"
                      variant="ghost"
                    >
                      <ChevronDown aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label="关闭查找"
                      className="mx-1"
                      onClick={closeFind}
                      size="icon-xs"
                      title="关闭查找"
                      variant="ghost"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    aria-label="页内查找"
                    onClick={() => setFindOpen(true)}
                    size="icon-sm"
                    title="页内查找"
                    variant="ghost"
                  >
                    <Search aria-hidden="true" />
                  </Button>
                )}
                <Button
                  disabled={opening}
                  onClick={() => void openSourceDocuments()}
                  size="sm"
                  variant="ghost"
                >
                  <FolderOpen aria-hidden="true" />
                  打开其他文档
                </Button>
              </div>
            </header>

            <div
              className={cn(
                'grid min-h-0 grid-cols-[minmax(0,1fr)]',
                sourceDiagram
                  ? 'grid-cols-[minmax(0,1fr)_360px]'
                  : outlinePreference === 'expanded' && 'grid-cols-[minmax(0,1fr)_232px]',
              )}
            >
              <main
                className="grid min-h-0 bg-background p-3"
                aria-label="Finished-document region"
              >
                {documentFrames.map((frame) => (
                  <FinishedDocumentFrame
                    draggingFiles={draggingFiles}
                    frame={frame}
                    key={frame.id}
                    onLoad={handleFinishedDocumentLoad}
                    onRemove={handleFinishedDocumentFrameRemove}
                    visible={frame.id === visibleFrame.id}
                  />
                ))}
              </main>
              {sourceDiagram ? (
                <DiagramSourceDrawer
                  copyText={window.fuxian.copyText}
                  diagram={sourceDiagram}
                  onClose={() => showDiagramSource(undefined)}
                />
              ) : outlinePreference === 'expanded' ? (
                <ContentOutline
                  activeHeadingId={activeHeadingId}
                  headings={activeDocument.headings}
                  key={activeDocument.document.path}
                  onNavigate={(id) => finishedDocumentController.current?.scrollToHeading(id)}
                />
              ) : null}
            </div>
            <DiagramFocusDialog
              copyText={window.fuxian.copyText}
              diagram={focusedDiagram}
              key={focusedDiagram?.id ?? 'closed-diagram-focus'}
              onClose={() => setFocusedDiagram(undefined)}
            />
          </div>
        ) : (
          <main className="flex min-h-0 items-center justify-center overflow-y-auto px-8 py-12">
            {blockingError ? (
              <Alert className="w-full max-w-md" variant="destructive">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>
                  <h1 id="error-title">无法打开文档</h1>
                </AlertTitle>
                <AlertDescription>
                  <p>{blockingError}</p>
                  <Button className="mt-3" onClick={() => void openSourceDocuments()}>
                    <FolderOpen aria-hidden="true" />
                    打开其他文档
                  </Button>
                </AlertDescription>
              </Alert>
            ) : unavailableDocuments.length > 0 ? (
              <Alert className="w-full max-w-md">
                <AlertCircle aria-hidden="true" />
                <AlertTitle>
                  <h1>部分文档暂时不可用</h1>
                </AlertTitle>
                <AlertDescription>
                  <p>可在左侧对文档执行重试、重新定位或移除。</p>
                  <Button className="mt-3" onClick={() => void openSourceDocuments()}>
                    <FolderOpen aria-hidden="true" />
                    打开其他文档
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <section className="w-full max-w-xl" aria-labelledby="start-title">
                <FuxianMark className="mb-6 size-20" />
                <h1 id="start-title" className="text-3xl font-semibold text-foreground">
                  浮现 Fuxian
                </h1>
                <div className="mt-8 border-t pt-6">
                  <Button disabled={opening} onClick={() => void openSourceDocuments()} size="lg">
                    <FolderOpen aria-hidden="true" />
                    {opening ? '正在打开...' : '打开 Markdown'}
                  </Button>
                  <p className="mt-3 text-sm text-muted-foreground">
                    也可以将 Markdown 文档拖放到窗口中
                  </p>
                </div>

                {startRecentDocuments.length > 0 ? (
                  <section className="mt-10 border-t pt-5" aria-labelledby="start-recent-title">
                    <div className="flex items-center justify-between gap-4">
                      <h2 id="start-recent-title" className="text-sm font-semibold">
                        最近打开
                      </h2>
                      {session.recentDocuments.length > 5 ? (
                        <Button
                          onClick={() => setShowAllStartRecent((current) => !current)}
                          size="xs"
                          variant="ghost"
                        >
                          {showAllStartRecent ? '收起' : '查看全部'}
                        </Button>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-col">
                      {startRecentDocuments.map((document) => (
                        <Tooltip key={document.path}>
                          <TooltipTrigger asChild>
                            <button
                              className="flex min-h-10 items-center gap-2 border-b px-1 text-left text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => void reopenDocument(document.path)}
                              type="button"
                            >
                              <FileText
                                aria-hidden="true"
                                className="size-4 shrink-0 text-muted-foreground"
                              />
                              <span className="truncate">{document.name}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={6}>
                            {document.path}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </section>
                ) : null}
              </section>
            )}
          </main>
        )}

        {draggingFiles ? (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center border-2 border-dashed border-primary bg-background/90 text-sm font-medium text-primary">
            松开以打开文档
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
