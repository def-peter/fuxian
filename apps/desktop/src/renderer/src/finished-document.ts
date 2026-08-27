import { documentThemeCss } from '@fuxian/document-theme';

export function createFinishedDocumentSource(body: string): string {
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

export function bindFinishedDocumentInteractions(
  frameDocument: Document,
  copyText: (text: string) => Promise<void>,
): () => void {
  const handleFinishedDocumentClick = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const button = target?.closest<HTMLButtonElement>('[data-copy-code]');
    const code = button?.closest('.code-block')?.querySelector('pre code');
    if (!button || !code) {
      return;
    }

    button.disabled = true;
    void copyText(code.textContent ?? '')
      .then(() => {
        button.textContent = '已复制';
      })
      .catch(() => {
        button.textContent = '失败';
      })
      .finally(() => {
        window.setTimeout(() => {
          button.disabled = false;
          button.textContent = '复制';
        }, 1200);
      });
  };

  frameDocument.addEventListener('click', handleFinishedDocumentClick);
  return () => frameDocument.removeEventListener('click', handleFinishedDocumentClick);
}
