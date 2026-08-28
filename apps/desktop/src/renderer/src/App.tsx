import { renderMarkdown } from '@fuxian/markdown-renderer';
import type {
  ExternalRevisionEvent,
  OpenSourceDocumentsResult,
  PdfExportProgress,
  ReadingPosition,
  ReadSourceDocumentResult,
  ReaderPreferences,
  SourceDocumentData,
} from '@fuxian/shared-types';
import {
  AlertCircle,
  ArrowDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FileDown,
  FolderOpen,
  PanelLeftOpen,
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
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContentOutline } from '@/content-outline';
import {
  activateDocument,
  addDocumentsToSession,
  applyFinishedDocumentRevision,
  beginReopenRecentDocument,
  closeDocument,
  createDocumentSession,
  createPersistedDocumentSession,
  createRestoredDocumentSession,
  failLoadingDocument,
  recoverUnavailableDocument,
  removeUnavailableDocument,
  setUnavailableDocumentMessage,
  updateReadingPosition,
  type FinishedSourceDocument,
  type LoadingSessionDocument,
  type SessionDocument,
} from '@/document-session';
import { DocumentSessionSidebar } from '@/document-session-sidebar';
import { DocumentWidthPopover } from '@/document-width-controls';
import { createDesktopPlantUmlRenderer } from '@/document-render-adapter';
import { DiagramFocusDialog, DiagramSourceDrawer } from '@/diagram-inspection';
import {
  getRenderRevisionFailure,
  isAppendedRevision,
  shouldFollowAppendedContent,
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
import { PdfExportPanel } from '@/pdf-export-panel';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';
import { useReaderPreferences } from '@/use-reader-preferences';
import { useShellLayout } from '@/use-shell-layout';

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });
const renderPlantUml = createDesktopPlantUmlRenderer(window.fuxian);
let externalFrameRevision = 0;

interface FinishedDocumentFrameRevision {
  document: FinishedSourceDocument;
  followBehavior: 'auto' | 'notify' | 'preserve';
  id: string;
  readingPosition: ReadingPosition;
  sessionPath: string;
  staging: boolean;
}

interface FinishedDocumentFrameProps {
  documentWidth: ReaderPreferences['documentWidth'];
  draggingFiles: boolean;
  frame: FinishedDocumentFrameRevision;
  onLoad(frame: FinishedDocumentFrameRevision, element: HTMLIFrameElement): void;
  onRemove(id: string): void;
  visible: boolean;
}

function FinishedDocumentFrame({
  documentWidth,
  draggingFiles,
  frame,
  onLoad,
  onRemove,
  visible,
}: FinishedDocumentFrameProps): React.JSX.Element {
  const element = useRef<HTMLIFrameElement>(null);
  useEffect(() => () => onRemove(frame.id), [frame.id, onRemove]);
  const surfaceWidth =
    documentWidth.mode === 'adaptive'
      ? '100%'
      : documentWidth.mode === 'a4'
        ? '794px'
        : `${documentWidth.customWidth}px`;

  return (
    <iframe
      aria-hidden={!visible}
      className={cn(
        'col-start-1 row-start-1 block h-full min-h-0 min-w-0 max-w-full justify-self-center border bg-card',
        visible ? 'visible z-10' : 'invisible pointer-events-none',
        draggingFiles && 'pointer-events-none',
      )}
      data-document-width-mode={documentWidth.mode}
      data-frame-revision={frame.id}
      onLoad={() => element.current && onLoad(frame, element.current)}
      ref={element}
      sandbox="allow-popups allow-same-origin"
      srcDoc={createFinishedDocumentSource(frame.document.html)}
      style={{ width: surfaceWidth }}
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
  const shellLayout = useShellLayout();
  const [session, setSession] = useState(createDocumentSession);
  const [restorationStatus, setRestorationStatus] = useState<'loading' | 'ready'>('loading');
  const [opening, setOpening] = useState(false);
  const [blockingError, setBlockingError] = useState<string>();
  const [showAllStartRecent, setShowAllStartRecent] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [contentOutlineSheetOpen, setContentOutlineSheetOpen] = useState(false);
  const [documentSessionSheetOpen, setDocumentSessionSheetOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState<FindResult>(emptyFindResult);
  const [sourceDiagram, setSourceDiagram] = useState<DiagramSnapshot>();
  const [focusedDiagram, setFocusedDiagram] = useState<DiagramSnapshot>();
  const [promotedRevisions, setPromotedRevisions] = useState(
    () => new Map<string, FinishedDocumentFrameRevision>(),
  );
  const [pendingRevisions, setPendingRevisions] = useState(
    () => new Map<string, FinishedDocumentFrameRevision>(),
  );
  const [externalRevisionStatuses, setExternalRevisionStatuses] = useState(
    () => new Map<string, ExternalRevisionStatus>(),
  );
  const [pdfExportProgress, setPdfExportProgress] = useState<PdfExportProgress>();
  const [pdfExportStarting, setPdfExportStarting] = useState(false);
  const pendingSystemOpenResults = useRef<OpenSourceDocumentsResult[]>([]);
  const restorationStatusRef = useRef(restorationStatus);
  const acceptOpenResultRef = useRef<(result: OpenSourceDocumentsResult) => void>(() => undefined);
  const finishedDocumentController = useRef<FinishedDocumentController | undefined>(undefined);
  const frameControllers = useRef(new Map<string, FinishedDocumentController>());
  const findInput = useRef<HTMLInputElement>(null);
  const findReturnFocus = useRef<HTMLElement | undefined>(undefined);
  const contentOutlineTrigger = useRef<HTMLButtonElement>(null);
  const documentSessionTrigger = useRef<HTMLButtonElement>(null);
  const dragDepth = useRef(0);
  const sessionRef = useRef(session);
  const diagramLayoutReadingPosition = useRef<ReadingPosition | undefined>(undefined);
  const pendingRevisionRefs = useRef(new Map<string, FinishedDocumentFrameRevision>());
  const recentDocumentCache = useRef(new Map<string, FinishedSourceDocument>());
  const visibleFrameIdRef = useRef<string | undefined>(undefined);
  const updatedStatusTimers = useRef(new Map<string, number>());
  const pdfExportDismissTimer = useRef<number | undefined>(undefined);

  const activeDocument = session.openDocuments.find(
    (document): document is SessionDocument =>
      document.status === 'available' && document.document.path === session.activeDocumentPath,
  );
  const activeLoadingDocument = session.openDocuments.find(
    (document): document is LoadingSessionDocument =>
      document.status === 'loading' && document.path === session.activeDocumentPath,
  );
  const sessionFrame = activeDocument
    ? {
        document: activeDocument,
        followBehavior: 'preserve' as const,
        id: `session:${activeDocument.document.path}`,
        readingPosition: activeDocument.readingPosition,
        sessionPath: activeDocument.document.path,
        staging: false,
      }
    : undefined;
  const promotedRevision = activeDocument
    ? promotedRevisions.get(activeDocument.document.path)
    : undefined;
  const visibleFrame = promotedRevision ?? sessionFrame;
  const externalRevisionStatus = session.activeDocumentPath
    ? (externalRevisionStatuses.get(session.activeDocumentPath) ?? { state: 'idle' as const })
    : { state: 'idle' as const };
  const documentSessionInline =
    shellLayout !== 'narrow' && preferences.shell.documentSessionExpanded;
  const contentOutlineInline = shellLayout === 'wide' && preferences.shell.contentOutlineExpanded;

  const updateShellPreferences = useCallback(
    (patch: Partial<typeof preferences.shell>): void => {
      updatePreferences({ ...preferences, shell: { ...preferences.shell, ...patch } });
    },
    [preferences, updatePreferences],
  );

  useEffect(() => {
    setContentOutlineSheetOpen(false);
    setDocumentSessionSheetOpen(false);
  }, [shellLayout]);

  const beginExternalRevision = useCallback((event: ExternalRevisionEvent): void => {
    const currentItem = sessionRef.current.openDocuments.find(
      (item) =>
        item.status !== 'unavailable' &&
        (item.status === 'available' ? item.document.path : item.path) === event.path,
    );
    if (!currentItem) return;
    const statusTimer = updatedStatusTimers.current.get(event.path);
    if (statusTimer) window.clearTimeout(statusTimer);
    updatedStatusTimers.current.delete(event.path);
    setExternalRevisionStatuses((current) =>
      new Map(current).set(event.path, { state: 'updating' }),
    );

    if (event.result.status === 'unavailable') {
      const message = event.result.message;
      pendingRevisionRefs.current.delete(event.path);
      setPendingRevisions((current) => {
        const next = new Map(current);
        next.delete(event.path);
        return next;
      });
      setExternalRevisionStatuses((current) =>
        new Map(current).set(event.path, { detail: message, state: 'failed' }),
      );
      if (currentItem.status === 'loading') {
        setSession((current) => {
          const next = failLoadingDocument(current, event.path, message);
          sessionRef.current = next;
          return next;
        });
      }
      return;
    }

    try {
      const document = finishSourceDocument(event.result.document);
      const active = sessionRef.current.activeDocumentPath === event.path;
      const readingPosition =
        active && currentItem.status === 'available'
          ? (finishedDocumentController.current?.getReadingPosition() ??
            currentItem.readingPosition)
          : currentItem.readingPosition;
      const appended =
        currentItem.status === 'available' &&
        isAppendedRevision(currentItem.document.source, document.document.source);
      const follow = active
        ? finishedDocumentController.current
          ? shouldFollowAppendedContent(finishedDocumentController.current.getViewportFollowState())
          : readingPosition.relativeProgress >= 0.95
        : readingPosition.relativeProgress >= 0.95;
      const frame: FinishedDocumentFrameRevision = {
        document,
        followBehavior: appended ? (follow ? 'auto' : 'notify') : 'preserve',
        id: `external:${event.path}:${++externalFrameRevision}`,
        readingPosition,
        sessionPath: event.path,
        staging: true,
      };
      pendingRevisionRefs.current.set(event.path, frame);
      setPendingRevisions((current) => new Map(current).set(event.path, frame));
    } catch (error) {
      pendingRevisionRefs.current.delete(event.path);
      setPendingRevisions((current) => {
        const next = new Map(current);
        next.delete(event.path);
        return next;
      });
      setExternalRevisionStatuses((current) =>
        new Map(current).set(event.path, {
          detail: error instanceof Error ? error.message : '新版本 Markdown 无法解析。',
          state: 'failed',
        }),
      );
    }
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    visibleFrameIdRef.current = visibleFrame?.id;
  }, [visibleFrame?.id]);

  useEffect(() => window.fuxian.onExternalRevision(beginExternalRevision), [beginExternalRevision]);

  useEffect(
    () =>
      window.fuxian.onPdfExportProgress((progress) => {
        setPdfExportProgress(progress);
        setPdfExportStarting(false);
        if (pdfExportDismissTimer.current) window.clearTimeout(pdfExportDismissTimer.current);
        if (progress.status === 'completed' || progress.status === 'cancelled') {
          pdfExportDismissTimer.current = window.setTimeout(() => {
            setPdfExportProgress((current) =>
              current?.exportId === progress.exportId ? undefined : current,
            );
          }, 4_000);
        }
      }),
    [],
  );

  const openWatchConfiguration = JSON.stringify(
    session.openDocuments.flatMap((document) =>
      document.status === 'available'
        ? [{ path: document.document.path, resourceUrls: document.resourceUrls }]
        : document.status === 'loading'
          ? [{ path: document.path, resourceUrls: [] }]
          : [],
    ),
  );
  useEffect(() => {
    const documents = JSON.parse(openWatchConfiguration) as Array<{
      path: string;
      resourceUrls: string[];
    }>;
    const activePath = documents.some((document) => document.path === session.activeDocumentPath)
      ? session.activeDocumentPath
      : undefined;
    void window.fuxian
      .configureOpenDocumentWatches({ ...(activePath ? { activePath } : {}), documents })
      .catch(() => undefined);
  }, [openWatchConfiguration, session.activeDocumentPath]);

  useEffect(() => {
    return () => {
      void window.fuxian.configureOpenDocumentWatches({ documents: [] }).catch(() => undefined);
    };
  }, []);

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
    const statusTimers = updatedStatusTimers.current;
    return () => {
      for (const controller of controllers.values()) controller.destroy();
      controllers.clear();
      for (const timer of statusTimers.values()) window.clearTimeout(timer);
      statusTimers.clear();
      if (pdfExportDismissTimer.current) window.clearTimeout(pdfExportDismissTimer.current);
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

  const openFind = useCallback((): void => {
    const activeElement = document.activeElement;
    if (!findReturnFocus.current) {
      findReturnFocus.current = activeElement instanceof HTMLElement ? activeElement : undefined;
    }
    setFindOpen(true);
  }, []);

  const closeFind = useCallback((): void => {
    const returnFocus = findReturnFocus.current;
    finishedDocumentController.current?.clearFind();
    setFindOpen(false);
    findReturnFocus.current = undefined;
    setFindQuery('');
    setFindResult(emptyFindResult());
    window.requestAnimationFrame(() => {
      returnFocus?.focus();
    });
  }, []);

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
        openFind();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [activeDocument, openFind]);

  const resetActiveDocumentControls = (): void => {
    finishedDocumentController.current = undefined;
    visibleFrameIdRef.current = undefined;
    setActiveHeadingId(undefined);
    setFindOpen(false);
    findReturnFocus.current = undefined;
    setFindQuery('');
    setFindResult(emptyFindResult());
    setSourceDiagram(undefined);
    setFocusedDiagram(undefined);
  };

  const showDiagramSource = (diagram: DiagramSnapshot | undefined): void => {
    diagramLayoutReadingPosition.current = finishedDocumentController.current?.getReadingPosition();
    setSourceDiagram(diagram);
  };

  const restoreDiagramActionFocus = (
    diagram: DiagramSnapshot | undefined,
    action: 'focus' | 'source',
  ): void => {
    if (!diagram) return;
    window.requestAnimationFrame(() =>
      finishedDocumentController.current?.focusDiagramAction(diagram.id, action),
    );
  };

  const closeDiagramSource = (): void => {
    const diagram = sourceDiagram;
    showDiagramSource(undefined);
    restoreDiagramActionFocus(diagram, 'source');
  };

  const locateSourceDiagram = (): void => {
    if (!sourceDiagram) return;
    if (!finishedDocumentController.current?.locateDiagram(sourceDiagram.id)) {
      setSourceDiagram(undefined);
    }
  };

  const handleFinishedDocumentFrameRemove = useCallback((id: string): void => {
    const controller = frameControllers.current.get(id);
    controller?.destroy();
    frameControllers.current.delete(id);
    if (finishedDocumentController.current === controller) {
      finishedDocumentController.current = undefined;
    }
  }, []);

  const scheduleUpdatedStatusClear = (path: string): void => {
    const oldTimer = updatedStatusTimers.current.get(path);
    if (oldTimer) window.clearTimeout(oldTimer);
    const timer = window.setTimeout(() => {
      updatedStatusTimers.current.delete(path);
      setExternalRevisionStatuses((current) => {
        if (current.get(path)?.state !== 'updated') return current;
        const next = new Map(current);
        next.delete(path);
        return next;
      });
    }, 5_000);
    updatedStatusTimers.current.set(path, timer);
  };

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
        if (visibleFrameIdRef.current === frame.id) openFind();
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
        const path = frame.sessionPath;
        if (pendingRevisionRefs.current.get(path)?.id !== frame.id) return;
        const failure = getRenderRevisionFailure(snapshot);
        if (failure) throw new Error(failure);

        const documentPath = frame.document.document.path;
        const active = sessionRef.current.activeDocumentPath === path;
        const readingPosition =
          frame.followBehavior === 'auto' ? controller.scrollToEnd() : frame.readingPosition;
        const oldVisibleFrameId = active ? visibleFrameIdRef.current : undefined;
        pendingRevisionRefs.current.delete(path);
        setPendingRevisions((current) => {
          const next = new Map(current);
          next.delete(path);
          return next;
        });
        setPromotedRevisions((current) => {
          const next = new Map(current);
          next.delete(path);
          if (active) {
            next.set(documentPath, {
              ...frame,
              readingPosition,
              sessionPath: documentPath,
              staging: false,
            });
          } else {
            next.delete(documentPath);
          }
          return next;
        });
        setSession((current) => {
          const next = applyFinishedDocumentRevision(
            current,
            path,
            frame.document,
            readingPosition,
          );
          sessionRef.current = next;
          return next;
        });
        if (active) {
          visibleFrameIdRef.current = frame.id;
          finishedDocumentController.current = controller;
          setSourceDiagram(undefined);
          setFocusedDiagram(undefined);
          setActiveHeadingId(readingPosition.headingId ?? frame.document.headings[0]?.id);
          setFindResult(findOpen ? controller.find(findQuery) : emptyFindResult());
        }
        const time = new Intl.DateTimeFormat('zh-CN', {
          hour: '2-digit',
          hour12: false,
          minute: '2-digit',
        }).format(new Date());
        const status: ExternalRevisionStatus =
          frame.followBehavior === 'notify' ? { state: 'new-content' } : { state: 'updated', time };
        setExternalRevisionStatuses((current) => {
          const next = new Map(current);
          next.delete(path);
          next.set(documentPath, status);
          return next;
        });
        if (status.state === 'updated') scheduleUpdatedStatusClear(documentPath);

        if (active && oldVisibleFrameId && oldVisibleFrameId !== frame.id) {
          frameControllers.current.get(oldVisibleFrameId)?.destroy();
          frameControllers.current.delete(oldVisibleFrameId);
        }
      })
      .catch((error: unknown) => {
        const path = frame.sessionPath;
        if (pendingRevisionRefs.current.get(path)?.id !== frame.id) return;
        pendingRevisionRefs.current.delete(path);
        setPendingRevisions((current) => {
          const next = new Map(current);
          next.delete(path);
          return next;
        });
        setExternalRevisionStatuses((current) =>
          new Map(current).set(path, {
            detail: error instanceof Error ? error.message : '新版本无法完整呈现。',
            state: 'failed',
          }),
        );
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
      resetActiveDocumentControls();
    }
    setBlockingError(undefined);
    setSession((current) => {
      const next = addDocumentsToSession(
        currentPath && currentPosition
          ? updateReadingPosition(current, currentPath, currentPosition)
          : current,
        finishedDocuments,
        Date.now(),
      );
      sessionRef.current = next;
      return next;
    });
  };
  acceptOpenResultRef.current = acceptOpenResult;
  restorationStatusRef.current = restorationStatus;

  useEffect(
    () =>
      window.fuxian.onSourceDocumentOpenRequested((result) => {
        if (restorationStatusRef.current !== 'ready') {
          pendingSystemOpenResults.current.push(result);
          return;
        }
        acceptOpenResultRef.current(result);
      }),
    [],
  );

  useEffect(() => {
    if (restorationStatus !== 'ready') return;
    for (const result of pendingSystemOpenResults.current.splice(0)) {
      acceptOpenResultRef.current(result);
    }
  }, [restorationStatus]);

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
      resetActiveDocumentControls();
      setSession((current) => {
        const next = activateDocument(
          currentPath && position ? updateReadingPosition(current, currentPath, position) : current,
          path,
        );
        sessionRef.current = next;
        return next;
      });
    }
  };

  const closeOpenDocument = (path: string): void => {
    const closingDocument = session.openDocuments.find(
      (document): document is SessionDocument =>
        document.status === 'available' && document.document.path === path,
    );
    if (closingDocument) recentDocumentCache.current.set(path, closingDocument);
    const position =
      path === session.activeDocumentPath
        ? finishedDocumentController.current?.getReadingPosition()
        : undefined;
    if (path === session.activeDocumentPath) {
      resetActiveDocumentControls();
    }
    pendingRevisionRefs.current.delete(path);
    setPendingRevisions((current) => {
      const next = new Map(current);
      next.delete(path);
      return next;
    });
    setPromotedRevisions((current) => {
      const next = new Map(current);
      next.delete(path);
      return next;
    });
    setExternalRevisionStatuses((current) => {
      const next = new Map(current);
      next.delete(path);
      return next;
    });
    const statusTimer = updatedStatusTimers.current.get(path);
    if (statusTimer) window.clearTimeout(statusTimer);
    updatedStatusTimers.current.delete(path);
    setSession((current) => {
      const next = closeDocument(
        position ? updateReadingPosition(current, path, position) : current,
        path,
        Date.now(),
      );
      sessionRef.current = next;
      return next;
    });
  };

  const reopenDocument = async (path: string): Promise<void> => {
    const currentPath = sessionRef.current.activeDocumentPath;
    const currentPosition = finishedDocumentController.current?.getReadingPosition();
    resetActiveDocumentControls();
    setBlockingError(undefined);
    setExternalRevisionStatuses((current) => new Map(current).set(path, { state: 'updating' }));
    const positioned =
      currentPath && currentPosition
        ? updateReadingPosition(sessionRef.current, currentPath, currentPosition)
        : sessionRef.current;
    const reopened = beginReopenRecentDocument(
      positioned,
      path,
      recentDocumentCache.current.get(path),
      Date.now(),
    );
    sessionRef.current = reopened;
    setSession(reopened);
    setOpening(true);
    try {
      const result = await window.fuxian.retrySourceDocument(path);
      beginExternalRevision({ path, result, revision: 0 });
    } catch {
      beginExternalRevision({
        path,
        result: { message: '应用暂时无法访问该文档。', status: 'unavailable' },
        revision: 0,
      });
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
    const statusTimer = updatedStatusTimers.current.get(path);
    if (statusTimer) window.clearTimeout(statusTimer);
    updatedStatusTimers.current.delete(path);
    setExternalRevisionStatuses((current) => new Map(current).set(path, { state: 'updating' }));
    try {
      beginExternalRevision({
        path,
        result: await window.fuxian.retrySourceDocument(path),
        revision: 0,
      });
    } catch {
      setExternalRevisionStatuses((current) =>
        new Map(current).set(path, {
          detail: '应用暂时无法重新读取源文档。',
          state: 'failed',
        }),
      );
    }
  };

  const startPdfExport = async (): Promise<void> => {
    const path = sessionRef.current.activeDocumentPath;
    const document = sessionRef.current.openDocuments.find(
      (item): item is SessionDocument => item.status === 'available' && item.document.path === path,
    );
    if (!path || !document || pdfExportStarting || pdfExportProgress?.status === 'running') return;
    setPdfExportStarting(true);
    try {
      const result = await window.fuxian.startPdfExport({
        path,
        preferences,
        renderedPlantUmlDiagrams: (finishedDocumentController.current?.getDiagramSnapshots() ?? [])
          .filter(
            (diagram): diagram is DiagramSnapshot & { kind: 'plantuml'; svg: string } =>
              diagram.kind === 'plantuml' && Boolean(diagram.svg),
          )
          .map(({ source, svg }) => ({ source, svg })),
        source: document.document.source,
      });
      if (result.status === 'started') {
        setPdfExportProgress((current) =>
          current?.exportId === result.exportId
            ? current
            : {
                exportId: result.exportId,
                progress: 5,
                stage: 'preparing',
                status: 'running',
              },
        );
      } else if (result.status === 'failed') {
        setPdfExportProgress({
          exportId: `failed:${Date.now()}`,
          message: result.message,
          status: 'failed',
        });
      }
    } catch {
      setPdfExportProgress({
        exportId: `failed:${Date.now()}`,
        message: '应用暂时无法启动 PDF 导出。',
        status: 'failed',
      });
    } finally {
      setPdfExportStarting(false);
    }
  };

  const cancelPdfExport = (): void => {
    if (pdfExportProgress?.status === 'running') {
      void window.fuxian.cancelPdfExport(pdfExportProgress.exportId);
    }
  };

  const showNewContent = (): void => {
    const path = sessionRef.current.activeDocumentPath;
    const controller = finishedDocumentController.current;
    if (!path || !controller) return;
    const position = controller.scrollToEnd();
    setSession((current) => {
      const next = updateReadingPosition(current, path, position);
      sessionRef.current = next;
      return next;
    });
    setExternalRevisionStatuses((current) => {
      const next = new Map(current);
      next.delete(path);
      return next;
    });
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
  const pendingFrames = [...pendingRevisions.values()];
  const documentFrames = visibleFrame
    ? [visibleFrame, ...pendingFrames.filter((frame) => frame.id !== visibleFrame.id)]
    : pendingFrames;
  const documentSessionSidebar = (
    <DocumentSessionSidebar
      activeDocumentPath={session.activeDocumentPath}
      isOpening={opening}
      onActivate={(path) => {
        setDocumentSessionSheetOpen(false);
        activateOpenDocument(path);
      }}
      onClose={closeOpenDocument}
      onCollapse={() => {
        if (shellLayout === 'narrow') {
          setDocumentSessionSheetOpen(false);
        } else {
          updateShellPreferences({ documentSessionExpanded: false });
        }
      }}
      onLocate={(path) => void locateUnavailableDocument(path)}
      onOpen={() => void openSourceDocuments()}
      onOpenSettings={() => void window.fuxian.openSettings()}
      onRemoveUnavailable={(path) =>
        setSession((current) => removeUnavailableDocument(current, path))
      }
      onReopen={(path) => {
        setDocumentSessionSheetOpen(false);
        void reopenDocument(path);
      }}
      onRetry={(path) => void retryUnavailableDocument(path)}
      openDocuments={session.openDocuments}
      recentDocuments={session.recentDocuments}
    />
  );

  return (
    <TooltipProvider>
      <div
        className={cn(
          'relative grid h-full bg-background',
          documentSessionInline ? 'grid-cols-[216px_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]',
        )}
        data-shell-layout={shellLayout}
        data-session-root=""
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {documentSessionInline ? documentSessionSidebar : null}
        {!documentSessionInline ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={shellLayout === 'narrow' ? '打开文档会话' : '展开文档会话'}
                className="absolute top-1 left-2 z-30"
                onClick={() => {
                  if (shellLayout === 'narrow') {
                    setDocumentSessionSheetOpen(true);
                  } else {
                    updateShellPreferences({ documentSessionExpanded: true });
                  }
                }}
                ref={documentSessionTrigger}
                size="icon-sm"
                variant="ghost"
              >
                <PanelLeftOpen aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {shellLayout === 'narrow' ? '打开文档会话' : '展开文档会话'}
            </TooltipContent>
          </Tooltip>
        ) : null}

        {restorationStatus === 'loading' ? (
          <main className="flex min-h-0 items-center justify-center text-sm text-muted-foreground">
            正在恢复上次会话...
          </main>
        ) : activeLoadingDocument ? (
          <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)] overflow-hidden">
            <header
              className={cn(
                'flex items-center gap-2 border-b bg-card px-4',
                !documentSessionInline && 'pl-12',
              )}
            >
              <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
              <span className="truncate text-sm font-semibold">{activeLoadingDocument.name}</span>
              <span
                aria-live="polite"
                className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground"
              >
                <Spinner aria-hidden="true" />
                正在更新...
              </span>
            </header>
            <main
              aria-label="正在准备文档"
              className="grid min-h-0 grid-cols-[minmax(0,1fr)] bg-background p-3"
            >
              <div className="col-start-1 row-start-1 mx-auto w-full max-w-3xl animate-pulse px-16 py-16">
                <div className="h-8 w-2/5 bg-muted" />
                <div className="mt-10 h-4 w-full bg-muted" />
                <div className="mt-4 h-4 w-11/12 bg-muted" />
                <div className="mt-4 h-4 w-4/5 bg-muted" />
                <div className="mt-12 h-6 w-1/3 bg-muted" />
                <div className="mt-6 h-4 w-full bg-muted" />
                <div className="mt-4 h-4 w-3/4 bg-muted" />
              </div>
              {pendingFrames.map((frame) => (
                <FinishedDocumentFrame
                  documentWidth={preferences.documentWidth}
                  draggingFiles={draggingFiles}
                  frame={frame}
                  key={frame.id}
                  onLoad={handleFinishedDocumentLoad}
                  onRemove={handleFinishedDocumentFrameRemove}
                  visible={false}
                />
              ))}
            </main>
          </div>
        ) : activeDocument && visibleFrame ? (
          <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)] overflow-hidden">
            <header
              className={cn(
                'flex items-center justify-between border-b bg-card px-4',
                !documentSessionInline && 'pl-12',
              )}
              data-reader-toolbar=""
            >
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                <span
                  aria-label={`${activeDocument.document.name}，${activeDocument.document.path}`}
                  className="truncate text-sm font-semibold"
                  title={activeDocument.document.path}
                >
                  {activeDocument.document.name}
                </span>
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
                    <CheckCircle2 aria-hidden="true" className="size-3.5 text-success" />
                    已更新 · {externalRevisionStatus.time}
                  </span>
                ) : null}
                {externalRevisionStatus.state === 'new-content' ? (
                  <Button
                    className="ml-2 shrink-0"
                    onClick={showNewContent}
                    size="xs"
                    variant="secondary"
                  >
                    <ArrowDown aria-hidden="true" />
                    有新内容
                  </Button>
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
                <Button
                  aria-label="导出 PDF"
                  disabled={pdfExportStarting || pdfExportProgress?.status === 'running'}
                  onClick={() => void startPdfExport()}
                  size="icon-sm"
                  title="导出 PDF"
                  variant="ghost"
                >
                  {pdfExportStarting ? (
                    <Spinner aria-hidden="true" />
                  ) : (
                    <FileDown aria-hidden="true" />
                  )}
                </Button>
                {findOpen ? (
                  <div
                    aria-label="页内查找"
                    className="flex h-8 items-center rounded-md border bg-background pl-2 shadow-xs"
                    role="search"
                  >
                    <Search aria-hidden="true" className="mr-2 size-4 text-muted-foreground" />
                    <input
                      aria-label="页内查找"
                      className="h-7 w-32 bg-transparent text-sm outline-none placeholder:text-muted-foreground min-[960px]:w-48"
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
                    onClick={openFind}
                    size="icon-sm"
                    title="页内查找"
                    variant="ghost"
                  >
                    <Search aria-hidden="true" />
                  </Button>
                )}
                <Button
                  aria-label="打开其他文档"
                  className="max-[1199px]:w-8 max-[1199px]:px-0"
                  disabled={opening}
                  onClick={() => void openSourceDocuments()}
                  size="sm"
                  variant="ghost"
                >
                  <FolderOpen aria-hidden="true" />
                  <span className="max-[1199px]:sr-only">打开其他文档</span>
                </Button>
                <Button
                  aria-label={
                    contentOutlineInline
                      ? '折叠内容目录'
                      : shellLayout === 'wide'
                        ? '展开内容目录'
                        : '打开内容目录'
                  }
                  onClick={() => {
                    if (contentOutlineInline) {
                      updateShellPreferences({ contentOutlineExpanded: false });
                    } else if (shellLayout === 'wide') {
                      updateShellPreferences({ contentOutlineExpanded: true });
                    } else {
                      setContentOutlineSheetOpen(true);
                    }
                  }}
                  ref={contentOutlineTrigger}
                  size="icon-sm"
                  title={
                    contentOutlineInline
                      ? '折叠内容目录'
                      : shellLayout === 'wide'
                        ? '展开内容目录'
                        : '打开内容目录'
                  }
                  variant="ghost"
                >
                  {contentOutlineInline ? (
                    <PanelRightClose aria-hidden="true" />
                  ) : (
                    <PanelRightOpen aria-hidden="true" />
                  )}
                </Button>
              </div>
            </header>

            <div
              className={cn(
                'grid min-h-0 grid-cols-[minmax(0,1fr)]',
                sourceDiagram
                  ? shellLayout === 'wide' && 'grid-cols-[minmax(0,1fr)_360px]'
                  : contentOutlineInline && 'grid-cols-[minmax(0,1fr)_216px]',
              )}
            >
              <main
                className="relative grid min-h-0 bg-background p-3"
                aria-label="完成文档阅读区"
                data-finished-document-region=""
              >
                {documentFrames.map((frame) => (
                  <FinishedDocumentFrame
                    documentWidth={preferences.documentWidth}
                    draggingFiles={draggingFiles}
                    frame={frame}
                    key={frame.id}
                    onLoad={handleFinishedDocumentLoad}
                    onRemove={handleFinishedDocumentFrameRemove}
                    visible={frame.id === visibleFrame.id}
                  />
                ))}
                {pdfExportProgress ? (
                  <PdfExportPanel
                    key={pdfExportProgress.exportId}
                    onCancel={cancelPdfExport}
                    onRetry={() => void startPdfExport()}
                    progress={pdfExportProgress}
                  />
                ) : null}
              </main>
              {sourceDiagram && shellLayout === 'wide' ? (
                <DiagramSourceDrawer
                  copyText={window.fuxian.copyText}
                  diagram={sourceDiagram}
                  onClose={closeDiagramSource}
                  onLocate={locateSourceDiagram}
                />
              ) : contentOutlineInline ? (
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
              onReturnFocus={(diagram) => restoreDiagramActionFocus(diagram, 'focus')}
            />
            {shellLayout !== 'wide' && activeDocument ? (
              <Sheet onOpenChange={setContentOutlineSheetOpen} open={contentOutlineSheetOpen}>
                <SheetContent
                  className="w-72 max-w-[88vw] p-0"
                  onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    contentOutlineTrigger.current?.focus();
                  }}
                  showCloseButton={false}
                >
                  <SheetTitle className="sr-only">内容目录</SheetTitle>
                  <SheetDescription className="sr-only">
                    浏览并跳转到当前文档中的标题。
                  </SheetDescription>
                  <ContentOutline
                    activeHeadingId={activeHeadingId}
                    headings={activeDocument.headings}
                    key={`sheet:${activeDocument.document.path}`}
                    onNavigate={(id) => {
                      finishedDocumentController.current?.scrollToHeading(id);
                      setContentOutlineSheetOpen(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            ) : null}
            {sourceDiagram && shellLayout !== 'wide' ? (
              <Sheet
                onOpenChange={(open) => !open && closeDiagramSource()}
                open={Boolean(sourceDiagram)}
              >
                <SheetContent className="w-[30rem] max-w-[92vw] p-0" showCloseButton={false}>
                  <SheetTitle className="sr-only">图表源码</SheetTitle>
                  <SheetDescription className="sr-only">
                    查看并复制当前 Mermaid 或 PlantUML 图表源码。
                  </SheetDescription>
                  <DiagramSourceDrawer
                    copyText={window.fuxian.copyText}
                    diagram={sourceDiagram}
                    onClose={closeDiagramSource}
                    onLocate={locateSourceDiagram}
                  />
                </SheetContent>
              </Sheet>
            ) : null}
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
                  浮现
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
        {shellLayout === 'narrow' ? (
          <Sheet onOpenChange={setDocumentSessionSheetOpen} open={documentSessionSheetOpen}>
            <SheetContent
              className="w-80 max-w-[90vw] p-0"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                documentSessionTrigger.current?.focus();
              }}
              showCloseButton={false}
              side="left"
            >
              <SheetTitle className="sr-only">文档会话</SheetTitle>
              <SheetDescription className="sr-only">
                切换正在打开的文档或重新打开最近文档。
              </SheetDescription>
              {documentSessionSidebar}
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
