import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractSourceDocumentPaths, isSupportedSourceDocumentPath } from './system-open';

describe('system open requests', () => {
  it('recognizes Markdown extensions without accepting similarly named files', () => {
    expect(isSupportedSourceDocumentPath('/docs/guide.md')).toBe(true);
    expect(isSupportedSourceDocumentPath('/docs/GUIDE.MARKDOWN')).toBe(true);
    expect(isSupportedSourceDocumentPath('/docs/guide.md.txt')).toBe(false);
    expect(isSupportedSourceDocumentPath('/docs/guide')).toBe(false);
  });

  it('extracts absolute and relative Markdown paths from process arguments', () => {
    expect(
      extractSourceDocumentPaths(
        ['/Applications/Fuxian', '/docs/first.md', 'notes/second.markdown', '--ignored.md'],
        '/work',
      ),
    ).toEqual(['/docs/first.md', resolve('/work', 'notes/second.markdown')]);
  });

  it('caps one operating-system request at one hundred documents', () => {
    const paths = Array.from({ length: 120 }, (_, index) => `${index}.md`);
    expect(extractSourceDocumentPaths(paths, '/work')).toHaveLength(100);
  });
});
