import { renderMarkdown } from '@fuxian/markdown-renderer';
import type { OpenSourceDocumentsResult, SourceDocumentData } from '@fuxian/shared-types';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ContentOutline, type ContentOutlinePreference } from '@/content-outline';
import {
  activateDocument,
  addDocumentsToSession,
  closeDocument,
  createDocumentSession,
  reopenRecentDocument,
  type FinishedSourceDocument,
} from '@/document-session';
import { DocumentSessionSidebar } from '@/document-session-sidebar';
import {
  bindFinishedDocument,
  createFinishedDocumentSource,
  type FindResult,
  type FinishedDocumentController,
} from '@/finished-document';
import { cn } from '@/lib/utils';

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });

const finishSourceDocument = (document: SourceDocumentData): FinishedSourceDocument => {
  const finishedDocument = renderMarkdown({
    resourceBaseUrl: document.resourceBaseUrl,
    source: document.source,
  });

  return {
    document,
    headings: finishedDocument.headings,
    html: finishedDocument.html,
  };
};

export function App(): React.JSX.Element {
  const [session, setSession] = useState(createDocumentSession);
  const [opening, setOpening] = useState(false);
  const [blockingError, setBlockingError] = useState<string>();
  const [showAllStartRecent, setShowAllStartRecent] = useState(false);
  const [draggingFiles, setDraggingFiles] = useState(false);
  const [outlinePreference, setOutlinePreference] = useState<ContentOutlinePreference>('expanded');
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState<FindResult>(emptyFindResult);
  const finishedDocumentFrame = useRef<HTMLIFrameElement>(null);
  const finishedDocumentController = useRef<FinishedDocumentController | undefined>(undefined);
  const findInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const activeDocument = session.openDocuments.find(
    (document) => document.document.path === session.activeDocumentPath,
  );

  useEffect(() => {
    return () => finishedDocumentController.current?.destroy();
  }, []);

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
    finishedDocumentController.current?.destroy();
    finishedDocumentController.current = undefined;
    setActiveHeadingId(undefined);
    setFindOpen(false);
    setFindQuery('');
    setFindResult(emptyFindResult());
  };

  const handleFinishedDocumentLoad = (): void => {
    finishedDocumentController.current?.destroy();

    const frameDocument = finishedDocumentFrame.current?.contentDocument;
    if (!frameDocument) {
      return;
    }

    const controller = bindFinishedDocument(frameDocument, {
      copyText: window.fuxian.copyText,
      onActiveHeadingChange: setActiveHeadingId,
      onFindRequest: () => setFindOpen(true),
    });
    finishedDocumentController.current = controller;
    setFindResult(findOpen ? controller.find(findQuery) : emptyFindResult());
  };

  const finishedDocumentSource = useMemo(
    () => (activeDocument ? createFinishedDocumentSource(activeDocument.html) : undefined),
    [activeDocument],
  );

  const acceptOpenResult = (result: OpenSourceDocumentsResult): void => {
    if (result.status === 'cancelled') {
      setOpening(false);
      return;
    }

    if (result.status === 'error') {
      setOpening(false);
      if (session.openDocuments.length === 0) {
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
      if (session.openDocuments.length === 0) {
        setBlockingError('选择的文档暂时无法呈现。请检查文件内容后重试。');
      }
      return;
    }

    if (finishedDocuments[0]?.document.path !== session.activeDocumentPath) {
      resetDocumentControls();
    }
    setBlockingError(undefined);
    setSession((current) => addDocumentsToSession(current, finishedDocuments, Date.now()));
  };

  const openSourceDocuments = async (): Promise<void> => {
    setOpening(true);
    try {
      acceptOpenResult(await window.fuxian.openSourceDocuments());
    } catch {
      setOpening(false);
      if (session.openDocuments.length === 0) {
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
      if (session.openDocuments.length === 0) {
        setBlockingError('应用无法读取拖入的文档。请确认文件仍然存在。');
      }
    }
  };

  const activateOpenDocument = (path: string): void => {
    if (path !== session.activeDocumentPath) {
      resetDocumentControls();
      setSession((current) => activateDocument(current, path));
    }
  };

  const closeOpenDocument = (path: string): void => {
    if (path === session.activeDocumentPath) {
      resetDocumentControls();
    }
    setSession((current) => closeDocument(current, path, Date.now()));
  };

  const reopenDocument = (path: string): void => {
    resetDocumentControls();
    setBlockingError(undefined);
    setSession((current) => reopenRecentDocument(current, path, Date.now()));
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
          onOpen={() => void openSourceDocuments()}
          onReopen={reopenDocument}
          openDocuments={session.openDocuments}
          recentDocuments={session.recentDocuments}
        />

        {activeDocument && finishedDocumentSource ? (
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
              </div>

              <div className="ml-4 flex shrink-0 items-center gap-1">
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
                outlinePreference === 'expanded' && 'grid-cols-[minmax(0,1fr)_232px]',
              )}
            >
              <main className="min-h-0 bg-background p-3" aria-label="Finished-document region">
                <iframe
                  className={cn(
                    'block h-full w-full border bg-card',
                    draggingFiles && 'pointer-events-none',
                  )}
                  key={activeDocument.document.path}
                  onLoad={handleFinishedDocumentLoad}
                  ref={finishedDocumentFrame}
                  sandbox="allow-popups allow-same-origin"
                  srcDoc={finishedDocumentSource}
                  title="Finished document"
                />
              </main>
              {outlinePreference === 'expanded' ? (
                <ContentOutline
                  activeHeadingId={activeHeadingId}
                  headings={activeDocument.headings}
                  key={activeDocument.document.path}
                  onNavigate={(id) => finishedDocumentController.current?.scrollToHeading(id)}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <main className="flex min-h-0 items-center justify-center overflow-y-auto px-8 py-12">
            {blockingError ? (
              <section className="w-full max-w-md" aria-labelledby="error-title" role="alert">
                <AlertCircle aria-hidden="true" className="mb-5 size-7 text-destructive" />
                <h1 id="error-title" className="text-xl font-semibold">
                  无法打开文档
                </h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{blockingError}</p>
                <Button className="mt-6" onClick={() => void openSourceDocuments()}>
                  <FolderOpen aria-hidden="true" />
                  打开其他文档
                </Button>
              </section>
            ) : (
              <section className="w-full max-w-xl" aria-labelledby="start-title">
                <div className="mb-10 h-px w-14 bg-primary" />
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
                        <Tooltip key={document.document.path}>
                          <TooltipTrigger asChild>
                            <button
                              className="flex min-h-10 items-center gap-2 border-b px-1 text-left text-sm outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => reopenDocument(document.document.path)}
                              type="button"
                            >
                              <FileText
                                aria-hidden="true"
                                className="size-4 shrink-0 text-muted-foreground"
                              />
                              <span className="truncate">{document.document.name}</span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" sideOffset={6}>
                            {document.document.path}
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
