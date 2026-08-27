export const desktopIpcChannels = {
  copyText: 'fuxian:clipboard:write-text',
  openDroppedSourceDocuments: 'fuxian:source-documents:open-dropped',
  openSourceDocuments: 'fuxian:source-documents:open',
} as const;

export interface SourceDocumentData {
  name: string;
  path: string;
  resourceBaseUrl: string;
  source: string;
}

export type OpenSourceDocumentsResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'opened'; documents: SourceDocumentData[]; warnings: string[] };

export interface FuxianDesktopBridge {
  copyText(text: string): Promise<void>;
  openDroppedSourceDocuments(files: File[]): Promise<OpenSourceDocumentsResult>;
  openSourceDocuments(): Promise<OpenSourceDocumentsResult>;
}
