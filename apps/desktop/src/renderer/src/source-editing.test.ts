import type { SourceDocumentData, SourceRecoveryDraft } from '@fuxian/shared-types';
import { describe, expect, it } from 'vitest';
import {
  adoptExternalSourceRevision,
  beginSourceEditSave,
  changeSourceEditBuffer,
  completeSourceEditSave,
  createSourceEditBuffer,
  createSourceRecoveryDraft,
  isSourceEditDirty,
  keepLocalSourceEdit,
  receiveExternalSourceRevision,
} from './source-editing';

const documentFixture = (source = '# Saved'): SourceDocumentData => ({
  name: 'guide.md',
  path: '/documents/guide.md',
  resourceBaseUrl: 'fuxian-document://source/',
  source,
});

describe('source editing', () => {
  it('tracks a dirty buffer independently from its saved baseline', () => {
    const changed = changeSourceEditBuffer(createSourceEditBuffer(documentFixture()), '# Local', {
      anchor: 7,
      head: 7,
    });

    expect(isSourceEditDirty(changed)).toBe(true);
    expect(createSourceRecoveryDraft(changed, 42)).toMatchObject({
      baselineSource: '# Saved',
      source: '# Local',
      updatedAt: 42,
    });
    expect(
      createSourceRecoveryDraft(completeSourceEditSave(changed, documentFixture('# Local')), 43),
    ).toBeUndefined();
  });

  it('accepts external revisions only while the edit buffer is clean', () => {
    const clean = createSourceEditBuffer(documentFixture());
    const refreshed = receiveExternalSourceRevision(clean, documentFixture('# External'));
    expect(refreshed).toMatchObject({
      baselineSource: '# External',
      source: '# External',
      status: 'editing',
    });

    const dirty = changeSourceEditBuffer(clean, '# Local', { anchor: 7, head: 7 });
    const conflicted = receiveExternalSourceRevision(dirty, documentFixture('# External'));
    expect(conflicted).toMatchObject({
      conflictDocument: { source: '# External' },
      source: '# Local',
      status: 'conflict',
    });
    expect(receiveExternalSourceRevision(dirty, documentFixture())).toBe(dirty);
  });

  it('requires an explicit choice before resolving an external conflict', () => {
    const conflicted = receiveExternalSourceRevision(
      changeSourceEditBuffer(createSourceEditBuffer(documentFixture()), '# Local', {
        anchor: 7,
        head: 7,
      }),
      documentFixture('# External'),
    );

    expect(keepLocalSourceEdit(conflicted)).toMatchObject({
      baselineSource: '# External',
      conflictDocument: undefined,
      source: '# Local',
    });
    expect(adoptExternalSourceRevision(conflicted)).toMatchObject({
      baselineSource: '# External',
      conflictDocument: undefined,
      source: '# External',
    });
  });

  it('restores a draft and detects changes made on disk while Fuxian was closed', () => {
    const draft: SourceRecoveryDraft = {
      baselineSource: '# Saved',
      name: 'guide.md',
      path: '/documents/guide.md',
      selection: { anchor: 99, head: 99 },
      source: '# Recovered',
      updatedAt: 42,
      version: 1,
    };

    expect(createSourceEditBuffer(documentFixture('# Disk changed'), draft)).toMatchObject({
      conflictDocument: { source: '# Disk changed' },
      selection: { anchor: 11, head: 11 },
      source: '# Recovered',
      status: 'conflict',
    });
  });

  it('keeps a completed save authoritative after a watcher echoes the same source', () => {
    const saving = beginSourceEditSave(
      changeSourceEditBuffer(createSourceEditBuffer(documentFixture()), '# Local', {
        anchor: 7,
        head: 7,
      }),
    );
    const saved = completeSourceEditSave(saving, documentFixture('# Local'));

    expect(receiveExternalSourceRevision(saved, documentFixture('# Local'))).toMatchObject({
      baselineSource: '# Local',
      source: '# Local',
      status: 'editing',
    });
  });
});
