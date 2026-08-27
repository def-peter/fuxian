import { documentThemeCss } from '@fuxian/document-theme';
import { renderMarkdown } from '@fuxian/markdown-renderer';
import type { OpenSourceDocumentResult, SourceDocumentData } from '@fuxian/shared-types';
import { AlertCircle, FileText, FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';

type ReaderState =
  | { status: 'start' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'reading'; document: SourceDocumentData; html: string };

function createFinishedDocumentSource(body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
    <style>${documentThemeCss}</style>
  </head>
  <body>
    <main class="finished-document">${body}</main>
  </body>
</html>`;
}

export function App(): React.JSX.Element {
  const [readerState, setReaderState] = useState<ReaderState>({ status: 'start' });

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
      const finishedDocument = renderMarkdown({ source: result.document.source });
      setReaderState({
        status: 'reading',
        document: result.document,
        html: finishedDocument.html,
      });
    } catch {
      setReaderState({
        status: 'error',
        message: '这份文档暂时无法呈现。请检查文件内容后重试。',
      });
    }
  };

  return (
    <div className="grid h-full grid-rows-[44px_minmax(0,1fr)] bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          {readerState.status === 'reading' ? (
            <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
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
          <Button variant="ghost" size="sm" onClick={openSourceDocument}>
            <FolderOpen aria-hidden="true" />
            打开其他文档
          </Button>
        ) : null}
      </header>

      {readerState.status === 'reading' && finishedDocumentSource ? (
        <main className="min-h-0 bg-background p-3" aria-label="Finished-document region">
          <iframe
            className="block h-full w-full border bg-card"
            sandbox="allow-popups"
            srcDoc={finishedDocumentSource}
            title="Finished document"
          />
        </main>
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
