import type { RenderRevisionSnapshot } from '@fuxian/render-protocol';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../localization';
import {
  getRenderRevisionFailure,
  isAppendedRevision,
  shouldFollowAppendedContent,
} from './external-revision';

const snapshot = (
  status: 'cancelled' | 'failed' | 'succeeded' | 'timed-out',
): RenderRevisionSnapshot => ({
  readiness: {
    cancelled: status === 'cancelled' ? 1 : 0,
    complete: true,
    failed: status === 'failed' ? 1 : 0,
    pending: 0,
    succeeded: status === 'succeeded' ? 1 : 0,
    timedOut: status === 'timed-out' ? 1 : 0,
    total: 1,
  },
  revisionId: 'external-1',
  tasks: [
    {
      attempt: 1,
      ...(status === 'failed' ? { error: 'invalid diagram' } : {}),
      id: 'diagram-1',
      kind: 'mermaid',
      source: 'graph TD',
      status,
    },
  ],
});

describe('external revision', () => {
  it('follows only true appends near the end without a selection', () => {
    expect(isAppendedRevision('# Notes', '# Notes\n\nNew paragraph')).toBe(true);
    expect(isAppendedRevision('# Notes', '# Revised notes')).toBe(false);
    expect(shouldFollowAppendedContent({ distanceFromEnd: 120, hasSelection: false })).toBe(true);
    expect(shouldFollowAppendedContent({ distanceFromEnd: 220, hasSelection: false })).toBe(false);
    expect(shouldFollowAppendedContent({ distanceFromEnd: 0, hasSelection: true })).toBe(false);
  });

  it('accepts only a fully successful render revision', () => {
    const zh = createTranslator('zh-CN');
    expect(getRenderRevisionFailure(snapshot('succeeded'), zh)).toBeUndefined();
    expect(getRenderRevisionFailure(snapshot('failed'), zh)).toContain('invalid diagram');
    expect(getRenderRevisionFailure(snapshot('timed-out'), zh)).toContain('渲染任务失败');
    expect(getRenderRevisionFailure(snapshot('cancelled'), zh)).toContain('更新版本取代');
  });

  it('localizes application-owned render failures while preserving technical details', () => {
    const en = createTranslator('en-US');
    expect(getRenderRevisionFailure(snapshot('timed-out'), en)).toBe('mermaid: Rendering failed.');
    expect(getRenderRevisionFailure(snapshot('failed'), en)).toContain('invalid diagram');
    expect(getRenderRevisionFailure(snapshot('cancelled'), en)).toBe(
      'This revision was replaced by a newer version.',
    );
  });
});
