import { renderMarkdown, type DocumentHeading } from '@fuxian/markdown-renderer';
import type { OpenSourceDocumentResult, SourceDocumentData } from '@fuxian/shared-types';
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
import { ContentOutline, type ContentOutlinePreference } from '@/content-outline';
import {
  bindFinishedDocument,
  createFinishedDocumentSource,
  type FindResult,
  type FinishedDocumentController,
} from '@/finished-document';

type ReaderState =
  | { status: 'start' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'reading';
      document: SourceDocumentData;
      headings: DocumentHeading[];
      html: string;
    };

const emptyFindResult = (): FindResult => ({ current: 0, total: 0 });

export function App(): React.JSX.Element {
  const [readerState, setReaderState] = useState<ReaderState>({ status: 'start' });
  const [outlinePreference, setOutlinePreference] = useState<ContentOutlinePreference>('expanded');
  const [activeHeadingId, setActiveHeadingId] = useState<string>();
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findResult, setFindResult] = useState<FindResult>(emptyFindResult);
  const finishedDocumentFrame = useRef<HTMLIFrameElement>(null);
  const finishedDocumentController = useRef<FinishedDocumentController | undefined>(undefined);
  const findInput = useRef<HTMLInputElement>(null);

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
        readerState.status === 'reading' &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLocaleLowerCase() === 'f'
      ) {
        event.preventDefault();
        setFindOpen(true);
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [readerState.status]);

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
    () =>
      readerState.status === 'reading' ? createFinishedDocumentSource(readerState.html) : undefined,
    [readerState],
  );

  const openSourceDocument = async (): Promise<void> => {
    const previousState = readerState;
    if (previousState.status !== 'reading') {
      setReaderState({ status: 'loading' });
    }

    let result: OpenSourceDocumentResult;
    try {
      result = await window.fuxian.openSourceDocument();
    } catch {
      setReaderState({
        status: 'error',
        message: '应用暂时无法访问文件。请重试或重新打开窗口。',
      });
      return;
    }

    if (result.status === 'cancelled') {
      setReaderState(previousState);
      return;
    }

    if (result.status === 'error') {
      setReaderState({ status: 'error', message: result.message });
      return;
    }

    try {
      const finishedDocument = renderMarkdown({
        resourceBaseUrl: result.document.resourceBaseUrl,
        source: result.document.source,
      });
      setReaderState({
        status: 'reading',
        document: result.document,
        headings: finishedDocument.headings,
        html: finishedDocument.html,
      });
      setActiveHeadingId(undefined);
      setFindOpen(false);
      setFindQuery('');
      setFindResult(emptyFindResult());
    } catch {
      setReaderState({
        status: 'error',
        message: '这份文档暂时无法呈现。请检查文件内容后重试。',
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

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)] bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4">
        <div className="flex min-w-0 items-center gap-1.5">
          {readerState.status === 'reading' ? (
            <>
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
            </>
          ) : (
            <span
              aria-hidden="true"
              className="relative size-6 overflow-hidden rounded-sm border border-primary/35 bg-accent"
            >
              <span className="absolute inset-x-1 bottom-1 h-px bg-primary/45" />
              <span className="absolute bottom-1 left-[6px] h-2 w-px bg-primary" />
              <span className="absolute bottom-1 left-[11px] h-3 w-px bg-primary" />
              <span className="absolute bottom-1 left-4 h-1.5 w-px bg-primary" />
            </span>
          )}
          <span className="truncate text-sm font-semibold">
            {readerState.status === 'reading' ? readerState.document.name : '浮现 Fuxian'}
          </span>
        </div>

        {readerState.status === 'reading' ? (
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
            <Button variant="ghost" size="sm" onClick={openSourceDocument}>
              <FolderOpen aria-hidden="true" />
              打开其他文档
            </Button>
          </div>
        ) : null}
      </header>

      {readerState.status === 'reading' && finishedDocumentSource ? (
        <div
          className={
            outlinePreference === 'expanded'
              ? 'grid min-h-0 grid-cols-[minmax(0,1fr)_232px]'
              : 'grid min-h-0 grid-cols-[minmax(0,1fr)]'
          }
        >
          <main className="min-h-0 bg-background p-3" aria-label="Finished-document region">
            <iframe
              className="block h-full w-full border bg-card"
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
              headings={readerState.headings}
              key={readerState.document.path}
              onNavigate={(id) => finishedDocumentController.current?.scrollToHeading(id)}
            />
          ) : null}
        </div>
      ) : (
        <main className="flex min-h-0 items-center justify-center px-8 py-12">
          {readerState.status === 'error' ? (
            <section className="w-full max-w-md" aria-labelledby="error-title" role="alert">
              <AlertCircle aria-hidden="true" className="mb-5 size-7 text-destructive" />
              <h1 id="error-title" className="text-xl font-semibold">
                无法打开文档
              </h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{readerState.message}</p>
              <Button className="mt-6" onClick={openSourceDocument}>
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
                <Button
                  size="lg"
                  disabled={readerState.status === 'loading'}
                  onClick={openSourceDocument}
                >
                  <FolderOpen aria-hidden="true" />
                  {readerState.status === 'loading' ? '正在打开...' : '打开 Markdown'}
                </Button>
              </div>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
