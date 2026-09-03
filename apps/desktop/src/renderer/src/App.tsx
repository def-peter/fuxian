import { renderMarkdown } from '@fuxian/markdown-renderer';
import {
  readerPreferenceLimits,
  type ExternalRevisionEvent,
  type OpenSourceDocumentsResult,
  type PdfExportProgress,
  type ReadingPosition,
  type ReadSourceDocumentResult,
  type ReaderPreferences,
  type SourceDocumentData,
} from '@fuxian/shared-types';
import type { LayoutChangedMeta, PanelImperativeHandle } from 'react-resizable-panels';
import {
  AlertCircle,
  ArrowDown,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  FileDown,
  FolderOpen,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Search,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui/segmented-control';
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
  forgetDocument,
  recoverUnavailableDocument,
  removeUnavailableDocument,
  setUnavailableDocumentMessage,
  updateReadingPosition,
  updateSourceDocumentRevision,
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
  type RenderedVisualSnapshot,
  type FindResult,
  type FinishedDocumentController,
} from '@/finished-document';
import { FuxianAppIcon } from '@/fuxian-mark';
import { cn } from '@/lib/utils';
import { PdfExportPanel } from '@/pdf-export-panel';
import { PaperPreviewFrame } from '@/paper-preview-frame';
import type { PaperPreviewSnapshot } from '@/paper-preview-protocol';
import { toDocumentThemePreferences } from '@/reader-preferences-theme';
import { useReaderPreferences } from '@/use-reader-preferences';
import { useShellLayout } from '@/use-shell-layout';
import { useAppUpdateStatus } from '@/use-app-update-status';
import { ArticleStructureMapDialog } from '@/article-structure-map-dialog';
import { ExternalConflictDialog, UnsavedChangesDialog } from '@/source-editing-dialogs';
import {
  adoptExternalSourceRevision,
  beginSourceEditSave,
  changeSourceEditBuffer,
  completeSourceEditSave,
  createSourceEditBuffer,
  createSourceRecoveryDraft,
  failSourceEditSave,
  isSourceEditDirty,
  keepLocalSourceEdit,
  receiveExternalSourceRevision,
  type SourceEditBuffer,
} from '@/source-editing';

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });
const defaultShellRegionWidth = 216;
const renderPlantUml = createDesktopPlantUmlRenderer(window.fuxian);
const SourceEditor = lazy(() => import('@/source-editor'));
let externalFrameRevision = 0;

type GuardedSourceAction =
  | { kind: 'accept-open'; result: OpenSourceDocumentsResult }
  | { kind: 'activate'; path: string }
  | { kind: 'close'; path: string }
  | { kind: 'close-window' }
  | { kind: 'install-update' }
  | { kind: 'quit' }
  | { kind: 'read' };

interface ToolbarTooltipProps {
  children: React.ReactElement;
  label: string;
  wrapTrigger?: boolean;
}

function ToolbarTooltip({
  children,
  label,
  wrapTrigger = false,
}: ToolbarTooltipProps): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {wrapTrigger ? <span className="inline-flex">{children}</span> : children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

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
  const appUpdateStatus = useAppUpdateStatus();
  const shellLayout = useShellLayout();
  const [session, setSession] = useState(createDocumentSession);
  const [restorationStatus, setRestorationStatus] = useState<'loading' | 'ready'>('loading');
  const [opening, setOpening] = useState(false);
  const [blockingError, setBlockingError] = useState<string>();
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [contentOutlineSheetOpen, setContentOutlineSheetOpen] = useState(false);
  const [articleStructureMapOpen, setArticleStructureMapOpen] = useState(false);
  const [documentSessionSheetOpen, setDocumentSessionSheetOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState<FindResult>(emptyFindResult);
  const [sourceDiagram, setSourceDiagram] = useState<RenderedVisualSnapshot>();
  const [focusedDiagram, setFocusedDiagram] = useState<RenderedVisualSnapshot>();
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
  const [viewMode, setViewMode] = useState<'continuous' | 'paper'>('continuous');
  const [paperSnapshot, setPaperSnapshot] = useState<PaperPreviewSnapshot>();
  const [paperPageCount, setPaperPageCount] = useState<number>();
  const [paperReadyRevisionId, setPaperReadyRevisionId] = useState<string>();
  const [paperPreviewFailure, setPaperPreviewFailure] = useState<string>();
  const [sourceEdit, setSourceEdit] = useState<SourceEditBuffer>();
  const [pendingSourceAction, setPendingSourceAction] = useState<GuardedSourceAction>();
  const pendingSystemOpenResults = useRef<OpenSourceDocumentsResult[]>([]);
  const restorationStatusRef = useRef(restorationStatus);
  const acceptOpenResultRef = useRef<(result: OpenSourceDocumentsResult) => void>(() => undefined);
  const finishedDocumentController = useRef<FinishedDocumentController | undefined>(undefined);
  const frameControllers = useRef(new Map<string, FinishedDocumentController>());
  const findInput = useRef<HTMLInputElement>(null);
  const findReturnFocus = useRef<HTMLElement | undefined>(undefined);
  const contentOutlineSheet = useRef<HTMLDivElement>(null);
  const contentOutlineTrigger = useRef<HTMLButtonElement>(null);
  const contentOutlinePanel = useRef<PanelImperativeHandle>(null);
  const documentSessionTrigger = useRef<HTMLButtonElement>(null);
  const documentSessionPanel = useRef<PanelImperativeHandle>(null);
  const dragDepth = useRef(0);
  const sessionRef = useRef(session);
  const diagramLayoutReadingPosition = useRef<ReadingPosition | undefined>(undefined);
  const pendingRevisionRefs = useRef(new Map<string, FinishedDocumentFrameRevision>());
  const recentDocumentCache = useRef(new Map<string, FinishedSourceDocument>());
  const visibleFrameIdRef = useRef<string | undefined>(undefined);
  const updatedStatusTimers = useRef(new Map<string, number>());
  const pdfExportDismissTimer = useRef<number | undefined>(undefined);
  const paperPreviewController = useRef<FinishedDocumentController | undefined>(undefined);
  const paperSnapshotRequest = useRef(0);
  const viewModeRef = useRef(viewMode);
  const sourceEditRef = useRef<SourceEditBuffer | undefined>(undefined);
  const pendingInstallResolution = useRef<
    { reject(error: Error): void; resolve(): void } | undefined
  >(undefined);
  const requestSourceActionRef = useRef<(action: GuardedSourceAction) => void>(() => undefined);

  const activeDocument = session.openDocuments.find(
    (document): document is SessionDocument =>
      document.status === 'available' &&
      document.latestSourceDocument.path === session.activeDocumentPath,
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
    ? promotedRevisions.get(activeDocument.latestSourceDocument.path)
    : undefined;
  const visibleFrame = promotedRevision ?? sessionFrame;
  const visibleFrameId = visibleFrame?.id;
  const externalRevisionStatus = session.activeDocumentPath
    ? (externalRevisionStatuses.get(session.activeDocumentPath) ?? { state: 'idle' as const })
    : { state: 'idle' as const };
  const documentSessionInline =
    shellLayout !== 'narrow' && preferences.shell.documentSessionExpanded;
  const contentOutlineInline =
    !sourceEdit && shellLayout === 'wide' && preferences.shell.contentOutlineExpanded;
  const contentOutlineActionLabel = contentOutlineInline ? '隐藏大纲' : '显示大纲';
  const getReadingController = useCallback(
    (): FinishedDocumentController | undefined =>
      viewModeRef.current === 'paper'
        ? (paperPreviewController.current ?? finishedDocumentController.current)
        : finishedDocumentController.current,
    [],
  );
  const persistCurrentSourceDraft = useCallback(async (): Promise<void> => {
    const buffer = sourceEditRef.current;
    if (!buffer) return;
    const draft = createSourceRecoveryDraft(buffer, Date.now());
    if (draft) {
      await window.fuxian.saveSourceRecoveryDraft(draft);
    } else {
      await window.fuxian.deleteSourceRecoveryDraft(buffer.path);
    }
  }, []);
  const commitSourceEdit = useCallback((buffer: SourceEditBuffer | undefined): void => {
    sourceEditRef.current = buffer;
    setSourceEdit(buffer);
  }, []);

  const forgetMissingDocument = useCallback((path: string): void => {
    const wasActive = sessionRef.current.activeDocumentPath === path;
    recentDocumentCache.current.delete(path);
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
    if (wasActive) {
      finishedDocumentController.current = undefined;
      paperPreviewController.current = undefined;
      paperSnapshotRequest.current += 1;
      visibleFrameIdRef.current = undefined;
      setActiveHeadingId(undefined);
      setFindOpen(false);
      findReturnFocus.current = undefined;
      setFindQuery('');
      setFindResult(emptyFindResult());
      setSourceDiagram(undefined);
      setFocusedDiagram(undefined);
      setPaperSnapshot(undefined);
      setPaperPageCount(undefined);
      setPaperReadyRevisionId(undefined);
      setPaperPreviewFailure(undefined);
    }
    setSession((current) => {
      const next = forgetDocument(current, path);
      sessionRef.current = next;
      return next;
    });
  }, []);

  const updateShellPreferences = useCallback(
    (patch: Partial<typeof preferences.shell>): void => {
      updatePreferences({ ...preferences, shell: { ...preferences.shell, ...patch } });
    },
    [preferences, updatePreferences],
  );

  const commitDocumentSessionWidth = useCallback(
    (meta: LayoutChangedMeta): void => {
      if (!meta.isUserInteraction) return;
      const width = Math.round(documentSessionPanel.current?.getSize().inPixels ?? 0);
      if (width === preferences.shell.documentSessionWidth) return;
      updateShellPreferences({ documentSessionWidth: width });
    },
    [preferences.shell.documentSessionWidth, updateShellPreferences],
  );

  const commitContentOutlineWidth = useCallback(
    (meta: LayoutChangedMeta): void => {
      if (!meta.isUserInteraction) return;
      const width = Math.round(contentOutlinePanel.current?.getSize().inPixels ?? 0);
      if (width === preferences.shell.contentOutlineWidth) return;
      updateShellPreferences({ contentOutlineWidth: width });
    },
    [preferences.shell.contentOutlineWidth, updateShellPreferences],
  );

  useEffect(() => {
    if (!documentSessionInline) return;
    const animationFrame = window.requestAnimationFrame(() => {
      documentSessionPanel.current?.resize(preferences.shell.documentSessionWidth);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [documentSessionInline, preferences.shell.documentSessionWidth]);

  useEffect(() => {
    if (!contentOutlineInline) return;
    let resizeFrame: number | undefined;
    const layoutFrame = window.requestAnimationFrame(() => {
      resizeFrame = window.requestAnimationFrame(() => {
        contentOutlinePanel.current?.resize(preferences.shell.contentOutlineWidth);
      });
    });
    return () => {
      window.cancelAnimationFrame(layoutFrame);
      if (resizeFrame !== undefined) window.cancelAnimationFrame(resizeFrame);
    };
  }, [contentOutlineInline, preferences.shell.contentOutlineWidth]);

  useEffect(() => {
    setContentOutlineSheetOpen(false);
    setDocumentSessionSheetOpen(false);
  }, [shellLayout]);

  useEffect(() => {
    setArticleStructureMapOpen(false);
  }, [session.activeDocumentPath]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const beginExternalRevision = useCallback(
    (event: ExternalRevisionEvent): void => {
      const currentEdit = sourceEditRef.current;
      if (currentEdit?.path === event.path && event.result.status === 'available') {
        const nextEdit = receiveExternalSourceRevision(currentEdit, event.result.document);
        if (nextEdit !== currentEdit) {
          sourceEditRef.current = nextEdit;
          setSourceEdit(nextEdit);
        }
        if (nextEdit.status === 'conflict') return;
      }
      const currentItem = sessionRef.current.openDocuments.find(
        (item) =>
          item.status !== 'unavailable' &&
          (item.status === 'available' ? item.latestSourceDocument.path : item.path) === event.path,
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
        if (event.result.reason === 'missing') {
          if (currentEdit?.path === event.path && isSourceEditDirty(currentEdit)) {
            void persistCurrentSourceDraft().catch(() => undefined);
            setExternalRevisionStatuses((current) =>
              new Map(current).set(event.path, {
                detail: '源文件已被移动或删除。未保存的源码仍保留在当前编辑器和恢复草稿中。',
                state: 'failed',
              }),
            );
            return;
          }
          if (currentEdit?.path === event.path) commitSourceEdit(undefined);
          forgetMissingDocument(event.path);
          return;
        }
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

      if (currentItem.status === 'available') {
        const nextSession = updateSourceDocumentRevision(
          sessionRef.current,
          event.path,
          event.result.document,
        );
        sessionRef.current = nextSession;
        setSession(nextSession);
      }

      try {
        const document = finishSourceDocument(event.result.document);
        const active = sessionRef.current.activeDocumentPath === event.path;
        const readingPosition =
          active && currentItem.status === 'available'
            ? (getReadingController()?.getReadingPosition() ?? currentItem.readingPosition)
            : currentItem.readingPosition;
        const appended =
          currentItem.status === 'available' &&
          isAppendedRevision(currentItem.document.source, document.document.source);
        const follow = active
          ? getReadingController()
            ? shouldFollowAppendedContent(getReadingController()!.getViewportFollowState())
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
    },
    [commitSourceEdit, forgetMissingDocument, getReadingController, persistCurrentSourceDraft],
  );

  const saveActiveSourceEdit = useCallback(async (): Promise<boolean> => {
    const buffer = sourceEditRef.current;
    if (!buffer || !isSourceEditDirty(buffer) || buffer.status === 'saving') return true;
    const saving = beginSourceEditSave(buffer);
    commitSourceEdit(saving);
    try {
      const result = await window.fuxian.saveSourceDocument({
        expectedSource: buffer.baselineSource,
        path: buffer.path,
        source: buffer.source,
      });
      if (result.status === 'conflict') {
        commitSourceEdit(receiveExternalSourceRevision(buffer, result.document));
        return false;
      }
      if (result.status === 'failed') {
        commitSourceEdit(failSourceEditSave(buffer, result.message));
        return false;
      }
      const saved = completeSourceEditSave(buffer, result.document);
      commitSourceEdit(saved);
      await window.fuxian.deleteSourceRecoveryDraft(buffer.path).catch(() => undefined);
      const currentItem = sessionRef.current.openDocuments.find(
        (item): item is SessionDocument =>
          item.status === 'available' && item.latestSourceDocument.path === buffer.path,
      );
      pendingRevisionRefs.current.delete(buffer.path);
      setPendingRevisions((current) => {
        const next = new Map(current);
        next.delete(buffer.path);
        return next;
      });
      setPromotedRevisions((current) => {
        const next = new Map(current);
        next.delete(buffer.path);
        return next;
      });
      setExternalRevisionStatuses((current) => {
        const next = new Map(current);
        next.delete(buffer.path);
        return next;
      });
      if (currentItem) {
        try {
          const finished = finishSourceDocument(result.document);
          const nextSession = applyFinishedDocumentRevision(
            sessionRef.current,
            buffer.path,
            finished,
            currentItem.readingPosition,
          );
          sessionRef.current = nextSession;
          setSession(nextSession);
        } catch (error) {
          const nextSession = updateSourceDocumentRevision(
            sessionRef.current,
            buffer.path,
            result.document,
          );
          sessionRef.current = nextSession;
          setSession(nextSession);
          setExternalRevisionStatuses((current) =>
            new Map(current).set(buffer.path, {
              detail:
                error instanceof Error
                  ? `源码已保存，但无法生成阅读内容：${error.message}`
                  : '源码已保存，但无法生成阅读内容。',
              state: 'failed',
            }),
          );
        }
      }
      return true;
    } catch {
      commitSourceEdit(failSourceEditSave(buffer, '应用暂时无法保存文档，请重试。'));
      return false;
    }
  }, [commitSourceEdit]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    sourceEditRef.current = sourceEdit;
  }, [sourceEdit]);

  useEffect(() => {
    visibleFrameIdRef.current = sourceEdit ? undefined : visibleFrame?.id;
  }, [sourceEdit, visibleFrame?.id]);

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
        ? [{ path: document.latestSourceDocument.path, resourceUrls: document.resourceUrls }]
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
    void (async () => {
      try {
        const result = await window.fuxian.loadDocumentSession();
        const drafts = await window.fuxian.loadSourceRecoveryDrafts();
        if (cancelled) return;
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
              reason: 'unreadable' as const,
            };
          }
        });
        let nextSession = createRestoredDocumentSession(result.session, restored, Date.now(), {
          missingDocumentPaths: result.missingDocumentPaths,
          protectedDocumentPaths: drafts.map(({ path }) => path),
        });
        const recoveryDraft = drafts.find((draft) =>
          nextSession.openDocuments.some(
            (item) => item.status === 'available' && item.latestSourceDocument.path === draft.path,
          ),
        );
        if (recoveryDraft) {
          const recoveryDocument = nextSession.openDocuments.find(
            (item): item is SessionDocument =>
              item.status === 'available' && item.latestSourceDocument.path === recoveryDraft.path,
          );
          if (recoveryDocument) {
            nextSession = activateDocument(nextSession, recoveryDraft.path);
            const buffer = createSourceEditBuffer(
              recoveryDocument.latestSourceDocument,
              recoveryDraft,
            );
            sourceEditRef.current = buffer;
            setSourceEdit(buffer);
            if (!isSourceEditDirty(buffer)) {
              void window.fuxian.deleteSourceRecoveryDraft(buffer.path).catch(() => undefined);
            }
          }
        }
        sessionRef.current = nextSession;
        setSession(nextSession);
      } catch {
        if (!cancelled) {
          setBlockingError('无法恢复上次文档会话。你仍可以重新打开文档。');
        }
      } finally {
        if (!cancelled) {
          setRestorationStatus('ready');
        }
      }
    })();

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
    if (!sourceEdit || restorationStatus !== 'ready') return;
    const saveTimer = window.setTimeout(() => {
      void persistCurrentSourceDraft().catch(() => undefined);
    }, 150);
    return () => window.clearTimeout(saveTimer);
  }, [persistCurrentSourceDraft, restorationStatus, sourceEdit]);

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
    if (viewMode !== 'paper' || !visibleFrameId) return;
    const request = ++paperSnapshotRequest.current;
    const controller = finishedDocumentController.current;
    if (!controller) return;
    setPaperPreviewFailure(undefined);
    void controller
      .whenRenderReady()
      .then(() => {
        if (paperSnapshotRequest.current !== request || viewModeRef.current !== 'paper') return;
        const theme = toDocumentThemePreferences(preferences, resolvedAppearance);
        const revisionId = `${visibleFrameId}:${theme.appearance}:${theme.bodyFamily}:${theme.bodySize}:${theme.lineHeight}`;
        setPaperSnapshot({
          html: controller.getStaticSnapshotHtml(),
          initialReadingPosition: getReadingController()?.getReadingPosition() ?? {
            headingOffset: 0,
            relativeProgress: 0,
          },
          preferences: theme,
          revisionId,
        });
      })
      .catch((error: unknown) => {
        if (paperSnapshotRequest.current !== request) return;
        setPaperPreviewFailure(error instanceof Error ? error.message : '无法准备纸张预览。');
      });
    return () => {
      if (paperSnapshotRequest.current === request) paperSnapshotRequest.current += 1;
    };
  }, [getReadingController, preferences, resolvedAppearance, viewMode, visibleFrameId]);

  useEffect(() => {
    const position = diagramLayoutReadingPosition.current;
    if (!position) return;
    const frame = window.requestAnimationFrame(() => {
      getReadingController()?.restoreReadingPosition(position);
      diagramLayoutReadingPosition.current = undefined;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [getReadingController, sourceDiagram]);

  useEffect(() => {
    const controller = getReadingController();
    setFindResult(
      findOpen ? (controller?.find(findQuery) ?? emptyFindResult()) : emptyFindResult(),
    );
    if (!findOpen) {
      controller?.clearFind();
    }
  }, [findOpen, findQuery, getReadingController, viewMode]);

  const openFind = useCallback((): void => {
    const activeElement = document.activeElement;
    if (!findReturnFocus.current) {
      findReturnFocus.current = activeElement instanceof HTMLElement ? activeElement : undefined;
    }
    setFindOpen(true);
  }, []);

  const closeFind = useCallback((): void => {
    const returnFocus = findReturnFocus.current;
    getReadingController()?.clearFind();
    setFindOpen(false);
    findReturnFocus.current = undefined;
    setFindQuery('');
    setFindResult(emptyFindResult());
    window.requestAnimationFrame(() => {
      returnFocus?.focus();
    });
  }, [getReadingController]);

  useEffect(() => {
    if (findOpen) {
      findInput.current?.focus();
    }
  }, [findOpen]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent): void => {
      if (
        sourceEditRef.current &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === 's'
      ) {
        event.preventDefault();
        void saveActiveSourceEdit();
        return;
      }
      if (
        activeDocument &&
        !sourceEditRef.current &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault();
        openFind();
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [activeDocument, openFind, saveActiveSourceEdit]);

  const resetActiveDocumentControls = (): void => {
    finishedDocumentController.current = undefined;
    paperPreviewController.current = undefined;
    paperSnapshotRequest.current += 1;
    visibleFrameIdRef.current = undefined;
    setActiveHeadingId(undefined);
    setFindOpen(false);
    findReturnFocus.current = undefined;
    setFindQuery('');
    setFindResult(emptyFindResult());
    setSourceDiagram(undefined);
    setFocusedDiagram(undefined);
    setPaperSnapshot(undefined);
    setPaperPageCount(undefined);
    setPaperReadyRevisionId(undefined);
    setPaperPreviewFailure(undefined);
  };

  const showDiagramSource = (diagram: RenderedVisualSnapshot | undefined): void => {
    diagramLayoutReadingPosition.current = getReadingController()?.getReadingPosition();
    setSourceDiagram(diagram);
  };

  const restoreDiagramActionFocus = (
    diagram: RenderedVisualSnapshot | undefined,
    action: 'focus' | 'source',
  ): void => {
    if (!diagram) return;
    window.requestAnimationFrame(() =>
      getReadingController()?.focusRenderedVisualAction(diagram.id, action),
    );
  };

  const closeDiagramSource = (): void => {
    const diagram = sourceDiagram;
    showDiagramSource(undefined);
    restoreDiagramActionFocus(diagram, 'source');
  };

  const locateSourceDiagram = (): void => {
    if (!sourceDiagram) return;
    if (!getReadingController()?.locateRenderedVisual(sourceDiagram.id)) {
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
      initialPlantUmlServerUrl: preferences.plantUml.serverUrl,
      initialReadingPosition: frame.readingPosition,
      onActiveHeadingChange: (id) => {
        if (visibleFrameIdRef.current === frame.id) setActiveHeadingId(id);
      },
      onFindRequest: () => {
        if (visibleFrameIdRef.current === frame.id) openFind();
      },
      onFocusRenderedVisual: (diagram) => {
        if (visibleFrameIdRef.current === frame.id) setFocusedDiagram(diagram);
      },
      onInspectRenderedVisual: (diagram) => {
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

  const performAcceptOpenResult = (result: OpenSourceDocumentsResult): void => {
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
      ? getReadingController()?.getReadingPosition()
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
  const acceptOpenResult = (result: OpenSourceDocumentsResult): void => {
    if (
      result.status === 'opened' &&
      isSourceEditDirty(sourceEditRef.current) &&
      result.documents[0]?.path !== sourceEditRef.current?.path
    ) {
      requestSourceActionRef.current({ kind: 'accept-open', result });
      return;
    }
    performAcceptOpenResult(result);
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

  const performActivateOpenDocument = (path: string): void => {
    if (path !== session.activeDocumentPath) {
      const currentPath = session.activeDocumentPath;
      const position = getReadingController()?.getReadingPosition();
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

  const performCloseOpenDocument = (path: string): void => {
    const closingDocument = session.openDocuments.find(
      (document): document is SessionDocument =>
        document.status === 'available' && document.latestSourceDocument.path === path,
    );
    if (closingDocument) recentDocumentCache.current.set(path, closingDocument);
    const position =
      path === session.activeDocumentPath
        ? getReadingController()?.getReadingPosition()
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

  const executeSourceAction = async (action: GuardedSourceAction): Promise<void> => {
    setPendingSourceAction(undefined);
    if (action.kind === 'accept-open') {
      commitSourceEdit(undefined);
      performAcceptOpenResult(action.result);
      return;
    }
    if (action.kind === 'read') {
      commitSourceEdit(undefined);
      return;
    }
    if (action.kind === 'activate') {
      commitSourceEdit(undefined);
      performActivateOpenDocument(action.path);
      return;
    }
    if (action.kind === 'close') {
      if (sourceEditRef.current?.path === action.path) commitSourceEdit(undefined);
      performCloseOpenDocument(action.path);
      return;
    }
    await persistCurrentSourceDraft().catch(() => undefined);
    const activePath = sessionRef.current.activeDocumentPath;
    const position = getReadingController()?.getReadingPosition();
    if (activePath && position) {
      sessionRef.current = updateReadingPosition(sessionRef.current, activePath, position);
      setSession(sessionRef.current);
    }
    await window.fuxian.saveDocumentSession(createPersistedDocumentSession(sessionRef.current));
    if (action.kind === 'quit' || action.kind === 'close-window') {
      commitSourceEdit(undefined);
      window.fuxian.confirmAppClose();
      return;
    }
    commitSourceEdit(undefined);
    pendingInstallResolution.current?.resolve();
    pendingInstallResolution.current = undefined;
  };

  const requestSourceAction = (action: GuardedSourceAction): void => {
    const buffer = sourceEditRef.current;
    const affectsBuffer =
      action.kind === 'install-update' ||
      action.kind === 'quit' ||
      action.kind === 'close-window' ||
      action.kind === 'read' ||
      action.kind === 'accept-open' ||
      (action.kind === 'activate' && action.path !== buffer?.path) ||
      (action.kind === 'close' && action.path === buffer?.path);
    if (affectsBuffer && isSourceEditDirty(buffer)) {
      setPendingSourceAction(action);
      return;
    }
    void executeSourceAction(action).catch(() => {
      if (action.kind === 'install-update') {
        pendingInstallResolution.current?.reject(new Error('无法保存当前文档会话。'));
        pendingInstallResolution.current = undefined;
      }
    });
  };
  requestSourceActionRef.current = requestSourceAction;

  useEffect(
    () =>
      window.fuxian.onAppCloseRequested((request) => {
        requestSourceActionRef.current({ kind: request.kind });
      }),
    [],
  );

  useEffect(
    () =>
      window.fuxian.onPrepareAppUpdateInstall(
        () =>
          new Promise<void>((resolve, reject) => {
            pendingInstallResolution.current = { reject, resolve };
            requestSourceActionRef.current({ kind: 'install-update' });
          }),
      ),
    [],
  );

  const activateOpenDocument = (path: string): void => {
    if (path === session.activeDocumentPath) return;
    requestSourceAction({ kind: 'activate', path });
  };

  const closeOpenDocument = (path: string): void => {
    requestSourceAction({ kind: 'close', path });
  };

  const enterSourceEditing = (): void => {
    if (!activeDocument || sourceEditRef.current) return;
    const position = getReadingController()?.getReadingPosition();
    if (position) {
      setSession((current) =>
        updateReadingPosition(current, activeDocument.latestSourceDocument.path, position),
      );
    }
    resetActiveDocumentControls();
    setArticleStructureMapOpen(false);
    setContentOutlineSheetOpen(false);
    commitSourceEdit(createSourceEditBuffer(activeDocument.latestSourceDocument));
  };

  const cancelPendingSourceAction = (): void => {
    if (pendingSourceAction?.kind === 'install-update') {
      pendingInstallResolution.current?.reject(new Error('存在尚未保存的 Markdown 修改。'));
      pendingInstallResolution.current = undefined;
    }
    setPendingSourceAction(undefined);
  };

  const discardSourceEditAndContinue = async (): Promise<void> => {
    const buffer = sourceEditRef.current;
    const action = pendingSourceAction;
    if (!buffer || !action) return;
    await window.fuxian.deleteSourceRecoveryDraft(buffer.path).catch(() => undefined);
    commitSourceEdit(undefined);
    requestSourceAction(action);
  };

  const saveSourceEditAndContinue = async (): Promise<void> => {
    const action = pendingSourceAction;
    if (!action) return;
    if (await saveActiveSourceEdit()) requestSourceAction(action);
  };

  const updateActiveSourceEdit = (
    source: string,
    selection: SourceEditBuffer['selection'],
  ): void => {
    const buffer = sourceEditRef.current;
    if (!buffer || buffer.status === 'saving') return;
    commitSourceEdit(changeSourceEditBuffer(buffer, source, selection));
  };

  const keepLocalAfterConflict = (): void => {
    const buffer = sourceEditRef.current;
    if (!buffer?.conflictDocument) return;
    commitSourceEdit(keepLocalSourceEdit(buffer));
  };

  const adoptDiskAfterConflict = async (): Promise<void> => {
    const buffer = sourceEditRef.current;
    const diskDocument = buffer?.conflictDocument;
    if (!buffer || !diskDocument) return;
    commitSourceEdit(adoptExternalSourceRevision(buffer));
    await window.fuxian.deleteSourceRecoveryDraft(buffer.path).catch(() => undefined);
    beginExternalRevision({
      path: buffer.path,
      result: { document: diskDocument, status: 'available' },
      revision: 0,
    });
    if (pendingSourceAction) requestSourceAction(pendingSourceAction);
  };

  const saveConflictingSourceAs = async (): Promise<void> => {
    const buffer = sourceEditRef.current;
    if (!buffer?.conflictDocument || buffer.status === 'saving') return;
    commitSourceEdit(beginSourceEditSave(buffer));
    try {
      const result = await window.fuxian.saveSourceDocumentAs({
        source: buffer.source,
        suggestedName: buffer.name,
      });
      if (result.status === 'cancelled') {
        commitSourceEdit(buffer);
        return;
      }
      if (result.status === 'failed') {
        commitSourceEdit(failSourceEditSave(buffer, result.message));
        return;
      }
      const finished = finishSourceDocument(result.document);
      resetActiveDocumentControls();
      setSession((current) => {
        const next = addDocumentsToSession(current, [finished], Date.now());
        sessionRef.current = next;
        return next;
      });
      commitSourceEdit(completeSourceEditSave(buffer, result.document));
      await window.fuxian.deleteSourceRecoveryDraft(buffer.path).catch(() => undefined);
      if (pendingSourceAction) requestSourceAction(pendingSourceAction);
    } catch {
      commitSourceEdit(failSourceEditSave(buffer, '应用暂时无法另存文档，请重试。'));
    }
  };

  const reopenDocument = async (path: string): Promise<void> => {
    const currentPath = sessionRef.current.activeDocumentPath;
    const currentPosition = getReadingController()?.getReadingPosition();
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
        result: {
          message: '应用暂时无法访问该文档。',
          reason: 'unreadable',
          status: 'unavailable',
        },
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

  const changeViewMode = (nextMode: 'continuous' | 'paper'): void => {
    if (nextMode === viewModeRef.current) return;
    const position = getReadingController()?.getReadingPosition();
    viewModeRef.current = nextMode;
    setViewMode(nextMode);
    setPaperPreviewFailure(undefined);
    if (nextMode === 'continuous' && position) {
      window.requestAnimationFrame(() => {
        finishedDocumentController.current?.restoreReadingPosition(position);
      });
    }
  };

  const startPdfExport = async (): Promise<void> => {
    const path = sessionRef.current.activeDocumentPath;
    const document = sessionRef.current.openDocuments.find(
      (item): item is SessionDocument =>
        item.status === 'available' && item.latestSourceDocument.path === path,
    );
    const controller = finishedDocumentController.current;
    if (
      !path ||
      !document ||
      !controller ||
      pdfExportStarting ||
      pdfExportProgress?.status === 'running'
    )
      return;
    setPdfExportStarting(true);
    try {
      await controller.whenRenderReady();
      const result = await window.fuxian.startPdfExport({
        ...(paperPageCount && paperReadyRevisionId === paperSnapshot?.revisionId
          ? { expectedPageCount: paperPageCount }
          : {}),
        finishedDocumentHtml: controller.getStaticSnapshotHtml(),
        path,
        preferences,
        renderedVisuals: controller
          .getRenderedVisualSnapshots()
          .filter(
            (
              diagram,
            ): diagram is RenderedVisualSnapshot & {
              kind: 'infographic' | 'plantuml' | 'vega-lite';
              svg: string;
            } =>
              (diagram.kind === 'infographic' ||
                diagram.kind === 'plantuml' ||
                diagram.kind === 'vega-lite') &&
              Boolean(diagram.svg),
          )
          .map(({ kind, source, svg }) => ({ kind, source, svg })),
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
    const controller = getReadingController();
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
    setFindResult(getReadingController()?.findNext() ?? emptyFindResult());
  };

  const showPreviousFindResult = (): void => {
    setFindResult(getReadingController()?.findPrevious() ?? emptyFindResult());
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

  const startRecentDocuments = session.recentDocuments.slice(0, 5);
  const unavailableDocuments = session.openDocuments.filter(
    (document) => document.status === 'unavailable',
  );
  const pendingFrames = [...pendingRevisions.values()];
  const documentFrames = visibleFrame
    ? [visibleFrame, ...pendingFrames.filter((frame) => frame.id !== visibleFrame.id)]
    : pendingFrames;
  const updateAttention =
    appUpdateStatus.phase === 'available' ||
    appUpdateStatus.phase === 'downloaded' ||
    appUpdateStatus.phase === 'downloading'
      ? appUpdateStatus.phase
      : undefined;
  const pendingSourceActionDescription = pendingSourceAction
    ? pendingSourceAction.kind === 'activate'
      ? '切换文档'
      : pendingSourceAction.kind === 'accept-open'
        ? '打开其他文档'
        : pendingSourceAction.kind === 'close'
          ? '关闭文档'
          : pendingSourceAction.kind === 'install-update'
            ? '安装更新'
            : pendingSourceAction.kind === 'quit'
              ? '退出浮现'
              : pendingSourceAction.kind === 'close-window'
                ? '关闭窗口'
                : '返回阅读模式'
    : '';
  const documentSessionSidebar = (
    <DocumentSessionSidebar
      activeDocumentPath={session.activeDocumentPath}
      appVersion={appUpdateStatus.currentVersion}
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
      onOpenSettings={() =>
        void window.fuxian.openSettings(
          appUpdateStatus.phase === 'available' ||
            appUpdateStatus.phase === 'downloaded' ||
            appUpdateStatus.phase === 'downloading'
            ? 'about'
            : undefined,
        )
      }
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
      {...(updateAttention ? { updateAttention } : {})}
    />
  );

  return (
    <TooltipProvider>
      <div
        className="relative h-full bg-background"
        data-shell-layout={shellLayout}
        data-session-root=""
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <ResizablePanelGroup
          className="min-h-0 min-w-0"
          id="reader-shell"
          onLayoutChanged={(_layout, meta) => commitDocumentSessionWidth(meta)}
          orientation="horizontal"
        >
          {documentSessionInline ? (
            <>
              <ResizablePanel
                className="min-h-0 min-w-0 !overflow-hidden"
                defaultSize={preferences.shell.documentSessionWidth}
                groupResizeBehavior="preserve-pixel-size"
                id="document-session"
                maxSize={readerPreferenceLimits.shellRegionWidth.max}
                minSize={readerPreferenceLimits.shellRegionWidth.min}
                panelRef={documentSessionPanel}
              >
                {documentSessionSidebar}
              </ResizablePanel>
              <ResizableHandle
                aria-label="调整文档会话宽度"
                disableDoubleClick
                id="document-session-resize-handle"
                onDoubleClick={() => {
                  documentSessionPanel.current?.resize(defaultShellRegionWidth);
                  updateShellPreferences({ documentSessionWidth: defaultShellRegionWidth });
                }}
              />
            </>
          ) : null}
          <ResizablePanel
            className="relative h-full min-h-0 min-w-0 !overflow-hidden"
            id="reader-content"
            minSize={400}
          >
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
              <main className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
                正在恢复上次会话...
              </main>
            ) : activeLoadingDocument ? (
              <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)] overflow-hidden">
                <header
                  className={cn(
                    'flex items-center gap-2 border-b bg-card px-4',
                    !documentSessionInline && 'pl-12',
                  )}
                >
                  <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
                  <span className="truncate text-sm font-semibold">
                    {activeLoadingDocument.name}
                  </span>
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
              <div className="grid h-full min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[44px_minmax(0,1fr)] overflow-hidden">
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
                      aria-label={`${activeDocument.latestSourceDocument.name}，${activeDocument.latestSourceDocument.path}`}
                      className="truncate text-sm font-semibold"
                      title={activeDocument.latestSourceDocument.path}
                    >
                      {activeDocument.latestSourceDocument.name}
                    </span>
                    {sourceEdit ? (
                      <span
                        aria-live="polite"
                        className={cn(
                          'ml-2 inline-flex shrink-0 items-center gap-1 text-xs',
                          sourceEdit.status === 'save-error' || sourceEdit.conflictDocument
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        {sourceEdit.status === 'saving' ? <Spinner aria-hidden="true" /> : null}
                        {sourceEdit.conflictDocument
                          ? '外部修改冲突'
                          : sourceEdit.status === 'saving'
                            ? '正在保存...'
                            : isSourceEditDirty(sourceEdit)
                              ? sourceEdit.recovered
                                ? '已恢复草稿 · 未保存'
                                : '未保存'
                              : '已保存'}
                      </span>
                    ) : null}
                    {!sourceEdit && externalRevisionStatus.state === 'updating' ? (
                      <span
                        aria-live="polite"
                        className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                      >
                        <Spinner aria-hidden="true" />
                        正在更新...
                      </span>
                    ) : null}
                    {!sourceEdit && externalRevisionStatus.state === 'updated' ? (
                      <span
                        aria-live="polite"
                        className="ml-2 inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
                      >
                        <CheckCircle2 aria-hidden="true" className="size-3.5 text-success" />
                        已更新 · {externalRevisionStatus.time}
                      </span>
                    ) : null}
                    {!sourceEdit && externalRevisionStatus.state === 'new-content' ? (
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
                    {!sourceEdit && externalRevisionStatus.state === 'failed' ? (
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

                  <div className="ml-2 flex shrink-0 items-center gap-1 min-[960px]:ml-4">
                    {sourceEdit ? (
                      <>
                        <ToolbarTooltip label="进入阅读模式">
                          <Button
                            aria-label="进入阅读模式"
                            onClick={() => requestSourceAction({ kind: 'read' })}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <BookOpen aria-hidden="true" />
                          </Button>
                        </ToolbarTooltip>
                        <ToolbarTooltip label="保存 Markdown">
                          <Button
                            aria-label="保存 Markdown"
                            disabled={
                              !isSourceEditDirty(sourceEdit) ||
                              sourceEdit.status === 'saving' ||
                              Boolean(sourceEdit.conflictDocument)
                            }
                            onClick={() => void saveActiveSourceEdit()}
                            size="icon-sm"
                            variant="ghost"
                          >
                            {sourceEdit.status === 'saving' ? (
                              <Spinner aria-hidden="true" />
                            ) : (
                              <Save aria-hidden="true" />
                            )}
                          </Button>
                        </ToolbarTooltip>
                      </>
                    ) : (
                      <>
                        <div
                          className="mr-2 flex shrink-0 items-center gap-1"
                          data-document-display-controls=""
                        >
                          <SegmentedControl
                            aria-label="文档显示模式"
                            onValueChange={(value) => {
                              if (value === 'continuous' || value === 'paper')
                                changeViewMode(value);
                            }}
                            type="single"
                            value={viewMode}
                          >
                            <ToolbarTooltip label="连续阅读" wrapTrigger>
                              <SegmentedControlItem
                                aria-label="无界阅读"
                                className="min-w-11"
                                value="continuous"
                              >
                                无界
                              </SegmentedControlItem>
                            </ToolbarTooltip>
                            <ToolbarTooltip label="A4 分页预览" wrapTrigger>
                              <SegmentedControlItem
                                aria-label="纸张预览"
                                className="min-w-11"
                                value="paper"
                              >
                                纸张
                              </SegmentedControlItem>
                            </ToolbarTooltip>
                          </SegmentedControl>
                          <div
                            className="flex h-7 w-20 shrink-0 items-center"
                            data-document-display-auxiliary=""
                          >
                            {viewMode === 'continuous' ? (
                              <DocumentWidthPopover
                                className="w-full justify-between"
                                onChange={(documentWidth) =>
                                  updatePreferences({ ...preferences, documentWidth })
                                }
                                value={preferences.documentWidth}
                              />
                            ) : paperPageCount ? (
                              <span className="w-full px-2 text-xs tabular-nums text-muted-foreground">
                                {paperPageCount} 页
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {findOpen ? (
                          <div
                            aria-label="页内查找"
                            className="flex h-8 items-center rounded-md border bg-background pl-2 shadow-xs"
                            role="search"
                          >
                            <Search
                              aria-hidden="true"
                              className="mr-2 size-4 text-muted-foreground"
                            />
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
                            <ToolbarTooltip label="上一个匹配项">
                              <Button
                                aria-label="上一个匹配项"
                                disabled={findResult.total === 0}
                                onClick={showPreviousFindResult}
                                size="icon-xs"
                                variant="ghost"
                              >
                                <ChevronUp aria-hidden="true" />
                              </Button>
                            </ToolbarTooltip>
                            <ToolbarTooltip label="下一个匹配项">
                              <Button
                                aria-label="下一个匹配项"
                                disabled={findResult.total === 0}
                                onClick={showNextFindResult}
                                size="icon-xs"
                                variant="ghost"
                              >
                                <ChevronDown aria-hidden="true" />
                              </Button>
                            </ToolbarTooltip>
                            <ToolbarTooltip label="关闭查找">
                              <Button
                                aria-label="关闭查找"
                                className="mx-1"
                                onClick={closeFind}
                                size="icon-xs"
                                variant="ghost"
                              >
                                <X aria-hidden="true" />
                              </Button>
                            </ToolbarTooltip>
                          </div>
                        ) : (
                          <ToolbarTooltip label="页内查找">
                            <Button
                              aria-label="页内查找"
                              onClick={openFind}
                              size="icon-sm"
                              variant="ghost"
                            >
                              <Search aria-hidden="true" />
                            </Button>
                          </ToolbarTooltip>
                        )}
                        <ToolbarTooltip label="进入编辑模式">
                          <Button
                            aria-label="进入编辑模式"
                            onClick={enterSourceEditing}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                        </ToolbarTooltip>
                        <ToolbarTooltip label="导出 PDF">
                          <Button
                            aria-label="导出 PDF"
                            disabled={pdfExportStarting || pdfExportProgress?.status === 'running'}
                            onClick={() => void startPdfExport()}
                            size="icon-sm"
                            variant="ghost"
                          >
                            {pdfExportStarting ? (
                              <Spinner aria-hidden="true" />
                            ) : (
                              <FileDown aria-hidden="true" />
                            )}
                          </Button>
                        </ToolbarTooltip>
                        <ToolbarTooltip label={contentOutlineActionLabel}>
                          <Button
                            aria-label={contentOutlineActionLabel}
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
                            variant="ghost"
                          >
                            {contentOutlineInline ? (
                              <PanelRightClose aria-hidden="true" />
                            ) : (
                              <PanelRightOpen aria-hidden="true" />
                            )}
                          </Button>
                        </ToolbarTooltip>
                      </>
                    )}
                  </div>
                </header>

                <ResizablePanelGroup
                  className="min-h-0 min-w-0"
                  id="reader-document-layout"
                  onLayoutChanged={(_layout, meta) => commitContentOutlineWidth(meta)}
                  orientation="horizontal"
                >
                  <ResizablePanel
                    className="min-h-0 min-w-0 !overflow-hidden"
                    id="finished-document"
                    minSize={360}
                  >
                    <main
                      className={cn(
                        'relative grid h-full min-h-0 bg-background',
                        sourceEdit ? 'grid-cols-1 grid-rows-1' : 'p-3',
                      )}
                      aria-label={sourceEdit ? 'Markdown 源码编辑区' : '完成文档阅读区'}
                      {...(sourceEdit
                        ? { 'data-source-editor-region': '' }
                        : { 'data-finished-document-region': '' })}
                    >
                      {sourceEdit ? (
                        <>
                          <Suspense
                            fallback={
                              <div className="flex items-center justify-center text-sm text-muted-foreground">
                                <Spinner aria-hidden="true" />
                                <span className="ml-2">正在准备源码编辑器...</span>
                              </div>
                            }
                          >
                            <SourceEditor
                              autoFocus
                              onChange={updateActiveSourceEdit}
                              onSave={() => void saveActiveSourceEdit()}
                              readOnly={sourceEdit.status === 'saving'}
                              selection={sourceEdit.selection}
                              source={sourceEdit.source}
                            />
                          </Suspense>
                          {sourceEdit.error ? (
                            <Alert
                              className="absolute right-4 bottom-4 max-w-sm"
                              variant="destructive"
                            >
                              <AlertCircle aria-hidden="true" />
                              <AlertTitle>保存失败</AlertTitle>
                              <AlertDescription>{sourceEdit.error}</AlertDescription>
                            </Alert>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {documentFrames.map((frame) => (
                            <FinishedDocumentFrame
                              documentWidth={preferences.documentWidth}
                              draggingFiles={draggingFiles}
                              frame={frame}
                              key={frame.id}
                              onLoad={handleFinishedDocumentLoad}
                              onRemove={handleFinishedDocumentFrameRemove}
                              visible={frame.id === visibleFrame.id && viewMode === 'continuous'}
                            />
                          ))}
                          {paperSnapshot &&
                          paperSnapshot.revisionId.startsWith(`${visibleFrame.id}:`) ? (
                            <PaperPreviewFrame
                              className={cn(
                                'col-start-1 row-start-1 z-10',
                                viewMode === 'paper' ? 'visible' : 'invisible pointer-events-none',
                                draggingFiles && 'pointer-events-none',
                              )}
                              key={activeDocument.latestSourceDocument.path}
                              onActiveHeadingChange={setActiveHeadingId}
                              onControllerChange={(controller) => {
                                paperPreviewController.current = controller;
                                if (controller && viewModeRef.current === 'paper' && findOpen) {
                                  setFindResult(controller.find(findQuery));
                                }
                              }}
                              onFailure={setPaperPreviewFailure}
                              onFindRequest={openFind}
                              onFindResult={setFindResult}
                              onFocusRenderedVisual={setFocusedDiagram}
                              onInspectRenderedVisual={showDiagramSource}
                              onReady={(pageCount, revisionId) => {
                                if (revisionId !== paperSnapshot.revisionId) return;
                                setPaperPageCount(pageCount);
                                setPaperReadyRevisionId(revisionId);
                                setPaperPreviewFailure(undefined);
                              }}
                              onReadingPositionChange={(position) => {
                                if (viewModeRef.current !== 'paper') return;
                                setSession((current) =>
                                  updateReadingPosition(
                                    current,
                                    activeDocument.latestSourceDocument.path,
                                    position,
                                  ),
                                );
                              }}
                              snapshot={paperSnapshot}
                            />
                          ) : null}
                          {viewMode === 'paper' && paperPreviewFailure ? (
                            <div
                              aria-live="polite"
                              className="absolute right-4 bottom-4 z-20 max-w-sm border border-destructive/40 bg-card px-3 py-2 text-xs text-destructive shadow-sm"
                            >
                              正在保留上一版纸张预览。{paperPreviewFailure}
                            </div>
                          ) : null}
                          {pdfExportProgress ? (
                            <PdfExportPanel
                              key={pdfExportProgress.exportId}
                              onCancel={cancelPdfExport}
                              onRetry={() => void startPdfExport()}
                              progress={pdfExportProgress}
                            />
                          ) : null}
                        </>
                      )}
                    </main>
                  </ResizablePanel>
                  {sourceDiagram && shellLayout === 'wide' ? (
                    <ResizablePanel
                      className="min-h-0 min-w-0 !overflow-hidden"
                      defaultSize={360}
                      disabled
                      groupResizeBehavior="preserve-pixel-size"
                      id="diagram-source"
                      maxSize={360}
                      minSize={360}
                    >
                      <DiagramSourceDrawer
                        copyText={window.fuxian.copyText}
                        diagram={sourceDiagram}
                        onClose={closeDiagramSource}
                        onLocate={locateSourceDiagram}
                      />
                    </ResizablePanel>
                  ) : contentOutlineInline ? (
                    <>
                      <ResizableHandle
                        aria-label="调整大纲宽度"
                        disableDoubleClick
                        id="content-outline-resize-handle"
                        onDoubleClick={() => {
                          contentOutlinePanel.current?.resize(defaultShellRegionWidth);
                          updateShellPreferences({ contentOutlineWidth: defaultShellRegionWidth });
                        }}
                      />
                      <ResizablePanel
                        className="min-h-0 min-w-0 !overflow-hidden"
                        defaultSize={preferences.shell.contentOutlineWidth}
                        groupResizeBehavior="preserve-pixel-size"
                        id="content-outline"
                        maxSize={readerPreferenceLimits.shellRegionWidth.max}
                        minSize={readerPreferenceLimits.shellRegionWidth.min}
                        panelRef={contentOutlinePanel}
                      >
                        <ContentOutline
                          activeHeadingId={activeHeadingId}
                          headings={activeDocument.headings}
                          key={activeDocument.latestSourceDocument.path}
                          onNavigate={(id) => getReadingController()?.scrollToHeading(id)}
                          onOpenStructureMap={() => setArticleStructureMapOpen(true)}
                        />
                      </ResizablePanel>
                    </>
                  ) : null}
                </ResizablePanelGroup>
                {sourceEdit && pendingSourceAction ? (
                  <UnsavedChangesDialog
                    actionDescription={pendingSourceActionDescription}
                    {...(sourceEdit.error ? { error: sourceEdit.error } : {})}
                    name={sourceEdit.name}
                    onCancel={cancelPendingSourceAction}
                    onDiscard={() => void discardSourceEditAndContinue()}
                    onSave={() => void saveSourceEditAndContinue()}
                    open={!sourceEdit.conflictDocument}
                    saving={sourceEdit.status === 'saving'}
                  />
                ) : null}
                {sourceEdit?.conflictDocument ? (
                  <ExternalConflictDialog
                    {...(sourceEdit.error ? { error: sourceEdit.error } : {})}
                    name={sourceEdit.name}
                    onAdoptDisk={() => void adoptDiskAfterConflict()}
                    onKeepLocal={keepLocalAfterConflict}
                    onSaveAs={() => void saveConflictingSourceAs()}
                    saving={sourceEdit.status === 'saving'}
                  />
                ) : null}
                <DiagramFocusDialog
                  copyText={window.fuxian.copyText}
                  diagram={focusedDiagram}
                  key={focusedDiagram?.id ?? 'closed-diagram-focus'}
                  onClose={() => setFocusedDiagram(undefined)}
                  onReturnFocus={(diagram) => restoreDiagramActionFocus(diagram, 'focus')}
                />
                {articleStructureMapOpen ? (
                  <ArticleStructureMapDialog
                    documentName={activeDocument.latestSourceDocument.name}
                    headings={activeDocument.headings}
                    onOpenChange={setArticleStructureMapOpen}
                    open
                  />
                ) : null}
                {!sourceEdit && shellLayout !== 'wide' && activeDocument ? (
                  <Sheet onOpenChange={setContentOutlineSheetOpen} open={contentOutlineSheetOpen}>
                    <SheetContent
                      className="w-72 max-w-[88vw] p-0"
                      onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        contentOutlineTrigger.current?.focus();
                      }}
                      onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        contentOutlineSheet.current?.focus();
                      }}
                      ref={contentOutlineSheet}
                      showCloseButton={false}
                    >
                      <SheetTitle className="sr-only">大纲</SheetTitle>
                      <SheetDescription className="sr-only">
                        浏览并跳转到当前文档中的标题。
                      </SheetDescription>
                      <ContentOutline
                        activeHeadingId={activeHeadingId}
                        headings={activeDocument.headings}
                        key={`sheet:${activeDocument.latestSourceDocument.path}`}
                        onNavigate={(id) => {
                          getReadingController()?.scrollToHeading(id);
                          setContentOutlineSheetOpen(false);
                        }}
                        onOpenStructureMap={() => {
                          setContentOutlineSheetOpen(false);
                          setArticleStructureMapOpen(true);
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
              <main className="flex h-full min-h-0 items-center justify-center overflow-y-auto px-8 py-12">
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
                  <section className="w-full max-w-lg" aria-labelledby="start-title">
                    <div className="flex flex-col items-center text-center">
                      <div className="flex items-center gap-4">
                        <FuxianAppIcon className="size-16" />
                        <h1 id="start-title" className="text-2xl font-semibold text-foreground">
                          浮现
                        </h1>
                      </div>
                      <p className="mt-4 text-sm text-muted-foreground">
                        让内容精彩浮现，让 Markdown 值得阅读。
                      </p>
                      <div className="mt-9 flex flex-col items-center gap-2">
                        <Button
                          disabled={opening}
                          onClick={() => void openSourceDocuments()}
                          size="lg"
                        >
                          <FolderOpen aria-hidden="true" data-icon="inline-start" />
                          {opening ? '正在打开...' : '打开 Markdown'}
                        </Button>
                        <p className="text-xs text-muted-foreground/70">或直接拖入文件</p>
                      </div>
                    </div>

                    {startRecentDocuments.length > 0 ? (
                      <section
                        className="mt-14 border-t pt-5 text-left"
                        aria-labelledby="start-recent-title"
                      >
                        <h2 id="start-recent-title" className="text-sm font-semibold">
                          最近查看
                        </h2>
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
          </ResizablePanel>
        </ResizablePanelGroup>

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
                切换正在查看的文档或重新查看最近文档。
              </SheetDescription>
              {documentSessionSidebar}
            </SheetContent>
          </Sheet>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
