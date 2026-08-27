export const desktopIpcChannels = {
  copyText: 'fuxian:clipboard:write-text',
  openSourceDocument: 'fuxian:source-document:open',
} as const;

export interface SourceDocumentData {
  name: string;
  path: string;
  resourceBaseUrl: string;
  source: string;
}

export type OpenSourceDocumentResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'opened'; document: SourceDocumentData };

export interface FuxianDesktopBridge {
  copyText(text: string): Promise<void>;
  openSourceDocument(): Promise<OpenSourceDocumentResult>;
}
