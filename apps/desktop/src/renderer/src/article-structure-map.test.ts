import type { DocumentHeading } from '@fuxian/markdown-renderer';
import { describe, expect, it } from 'vitest';
import { buildArticleStructureMap } from './article-structure-map';

describe('article structure map', () => {
  it('reuses the only top-level heading as the root and preserves skipped-depth nesting', () => {
    const headings: DocumentHeading[] = [
      { depth: 1, id: 'guide', text: '指南' },
      { depth: 3, id: 'install', text: '安装' },
      { depth: 4, id: 'mac', text: 'macOS' },
      { depth: 2, id: 'usage', text: '使用' },
    ];

    expect(buildArticleStructureMap(headings, 'guide.md')).toEqual({
      children: [
        { children: [{ children: [], content: 'macOS' }], content: '安装' },
        { children: [], content: '使用' },
      ],
      content: '指南',
    });
  });

  it('adds the document name as a synthetic root for multiple top-level headings', () => {
    const headings: DocumentHeading[] = [
      { depth: 2, id: 'first', text: '第一部分' },
      { depth: 2, id: 'second', text: '第二部分' },
    ];

    expect(buildArticleStructureMap(headings, '方案.markdown')).toEqual({
      children: [
        { children: [], content: '第一部分' },
        { children: [], content: '第二部分' },
      ],
      content: '方案',
    });
  });

  it('escapes heading text before Markmap writes node content as HTML', () => {
    expect(
      buildArticleStructureMap(
        [{ depth: 1, id: 'unsafe', text: '<img src=x onerror="bad()"> & notes' }],
        'unsafe.md',
      ),
    ).toMatchObject({ content: '&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp; notes' });
  });

  it('does not create a structure map without headings', () => {
    expect(buildArticleStructureMap([], 'empty.md')).toBeUndefined();
  });
});
