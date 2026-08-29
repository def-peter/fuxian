import type { DocumentThemePreferences } from '@fuxian/document-theme';
import type { ReadingPosition } from '@fuxian/shared-types';
import type { FindResult, RenderedVisualSnapshot } from './finished-document';

export type PaperScaleMode = 'actual' | 'fit-width';

export interface PaperPreviewSnapshot {
  html: string;
  initialReadingPosition: ReadingPosition;
  preferences: DocumentThemePreferences;
  revisionId: string;
}

interface PaperPreviewMessageBase {
  channelId: string;
  scope: 'fuxian-paper-preview';
}

export type PaperPreviewHostPayload =
  | { command: 'clear-find'; type: 'command' }
  | { command: 'find'; query: string; type: 'command' }
  | { command: 'find-next' | 'find-previous' | 'scroll-to-end'; type: 'command' }
  | { command: 'focus-visual-action'; id: string; action: 'focus' | 'source'; type: 'command' }
  | { command: 'locate-visual' | 'scroll-to-heading'; id: string; type: 'command' }
  | { command: 'restore-reading-position'; position: ReadingPosition; type: 'command' }
  | { scaleMode: PaperScaleMode; type: 'scale' }
  | { snapshot: PaperPreviewSnapshot; type: 'render' };

export type PaperPreviewHostMessage = PaperPreviewMessageBase & PaperPreviewHostPayload;

export type PaperPreviewFramePayload =
  | { type: 'mounted' }
  | { text: string; type: 'copy-text' }
  | { message: string; revisionId: string; type: 'failed' }
  | { pageCount: number; position: ReadingPosition; revisionId: string; type: 'ready' }
  | { findResult: FindResult; type: 'find-result' }
  | {
      activeHeadingId?: string;
      followState: { distanceFromEnd: number; hasSelection: boolean };
      position: ReadingPosition;
      type: 'reading-position';
    }
  | { type: 'find-request' }
  | { action: 'focus' | 'source'; type: 'visual-action'; visual: RenderedVisualSnapshot };

export type PaperPreviewFrameMessage = PaperPreviewMessageBase & PaperPreviewFramePayload;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

export const isPaperPreviewHostMessage = (
  value: unknown,
  channelId: string,
): value is PaperPreviewHostMessage =>
  isRecord(value) &&
  value.scope === 'fuxian-paper-preview' &&
  value.channelId === channelId &&
  typeof value.type === 'string';

export const isPaperPreviewFrameMessage = (
  value: unknown,
  channelId: string,
): value is PaperPreviewFrameMessage =>
  isRecord(value) &&
  value.scope === 'fuxian-paper-preview' &&
  value.channelId === channelId &&
  typeof value.type === 'string';
