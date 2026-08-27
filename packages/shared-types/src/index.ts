export const desktopIpcChannels = {
  openSourceDocument: 'fuxian:source-document:open',
} as const;

export interface SourceDocumentData {
  name: string;
  path: string;
  source: string;
}

export type OpenSourceDocumentResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'opened'; document: SourceDocumentData };

export interface FuxianDesktopBridge {
  openSourceDocument(): Promise<OpenSourceDocumentResult>;
}
