import type {
  SourceDocumentData,
  SourceEditorSelection,
  SourceRecoveryDraft,
} from '@fuxian/shared-types';

export type SourceEditStatus = 'conflict' | 'editing' | 'save-error' | 'saving';

export interface SourceEditBuffer {
  baselineSource: string;
  conflictDocument?: SourceDocumentData | undefined;
  error?: string | undefined;
  name: string;
  path: string;
  recovered: boolean;
  selection: SourceEditorSelection;
  source: string;
  status: SourceEditStatus;
}

const clampSelection = (
  selection: SourceEditorSelection,
  source: string,
): SourceEditorSelection => ({
  anchor: Math.min(source.length, Math.max(0, Math.round(selection.anchor))),
  head: Math.min(source.length, Math.max(0, Math.round(selection.head))),
});

export const createSourceEditBuffer = (
  document: SourceDocumentData,
  draft?: SourceRecoveryDraft,
): SourceEditBuffer => {
  if (!draft || draft.path !== document.path || draft.source === document.source) {
    return {
      baselineSource: document.source,
      name: document.name,
      path: document.path,
      recovered: Boolean(draft),
      selection: clampSelection(draft?.selection ?? { anchor: 0, head: 0 }, document.source),
      source: document.source,
      status: 'editing',
    };
  }

  const conflictDocument = draft.baselineSource === document.source ? undefined : document;
  return {
    baselineSource: draft.baselineSource,
    ...(conflictDocument ? { conflictDocument } : {}),
    name: document.name,
    path: document.path,
    recovered: true,
    selection: clampSelection(draft.selection, draft.source),
    source: draft.source,
    status: conflictDocument ? 'conflict' : 'editing',
  };
};

export const isSourceEditDirty = (buffer: SourceEditBuffer | undefined): boolean =>
  Boolean(buffer && buffer.source !== buffer.baselineSource);

export const changeSourceEditBuffer = (
  buffer: SourceEditBuffer,
  source: string,
  selection: SourceEditorSelection,
): SourceEditBuffer => ({
  ...buffer,
  error: undefined,
  recovered: false,
  selection: clampSelection(selection, source),
  source,
  status: buffer.conflictDocument ? 'conflict' : 'editing',
});

export const updateSourceEditSelection = (
  buffer: SourceEditBuffer,
  selection: SourceEditorSelection,
): SourceEditBuffer => ({ ...buffer, selection: clampSelection(selection, buffer.source) });

export const receiveExternalSourceRevision = (
  buffer: SourceEditBuffer,
  document: SourceDocumentData,
): SourceEditBuffer => {
  if (document.path !== buffer.path) return buffer;
  if (document.source === buffer.baselineSource) return buffer;
  if (document.source === buffer.source) {
    return {
      ...buffer,
      baselineSource: document.source,
      conflictDocument: undefined,
      error: undefined,
      name: document.name,
      status: 'editing',
    };
  }
  if (isSourceEditDirty(buffer)) {
    return {
      ...buffer,
      conflictDocument: document,
      error: undefined,
      status: 'conflict',
    };
  }
  return {
    ...buffer,
    baselineSource: document.source,
    conflictDocument: undefined,
    error: undefined,
    name: document.name,
    selection: clampSelection(buffer.selection, document.source),
    source: document.source,
    status: 'editing',
  };
};

export const beginSourceEditSave = (buffer: SourceEditBuffer): SourceEditBuffer => ({
  ...buffer,
  error: undefined,
  status: 'saving',
});

export const completeSourceEditSave = (
  buffer: SourceEditBuffer,
  document: SourceDocumentData,
): SourceEditBuffer => ({
  ...buffer,
  baselineSource: document.source,
  conflictDocument: undefined,
  error: undefined,
  name: document.name,
  path: document.path,
  recovered: false,
  selection: clampSelection(buffer.selection, document.source),
  source: document.source,
  status: 'editing',
});

export const failSourceEditSave = (
  buffer: SourceEditBuffer,
  message: string,
): SourceEditBuffer => ({ ...buffer, error: message, status: 'save-error' });

export const keepLocalSourceEdit = (buffer: SourceEditBuffer): SourceEditBuffer => {
  if (!buffer.conflictDocument) return buffer;
  return {
    ...buffer,
    baselineSource: buffer.conflictDocument.source,
    conflictDocument: undefined,
    error: undefined,
    status: 'editing',
  };
};

export const adoptExternalSourceRevision = (buffer: SourceEditBuffer): SourceEditBuffer =>
  buffer.conflictDocument
    ? {
        ...buffer,
        baselineSource: buffer.conflictDocument.source,
        conflictDocument: undefined,
        error: undefined,
        name: buffer.conflictDocument.name,
        selection: clampSelection(buffer.selection, buffer.conflictDocument.source),
        source: buffer.conflictDocument.source,
        status: 'editing',
      }
    : buffer;

export const createSourceRecoveryDraft = (
  buffer: SourceEditBuffer,
  updatedAt: number,
): SourceRecoveryDraft | undefined =>
  isSourceEditDirty(buffer)
    ? {
        baselineSource: buffer.baselineSource,
        name: buffer.name,
        path: buffer.path,
        selection: buffer.selection,
        source: buffer.source,
        updatedAt,
        version: 1,
      }
    : undefined;
