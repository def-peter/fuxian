import { describe, expect, it, vi } from 'vitest';
import { copyDiagramContent } from './diagram-copy';

describe('diagram inspection', () => {
  it('reports clipboard success and failure without throwing into the UI', async () => {
    const successfulCopy = vi.fn(async () => undefined);
    const failedCopy = vi.fn(async () => {
      throw new Error('clipboard unavailable');
    });

    await expect(copyDiagramContent(successfulCopy, 'diagram source')).resolves.toBe('copied');
    await expect(copyDiagramContent(failedCopy, '<svg />')).resolves.toBe('failed');
  });
});
