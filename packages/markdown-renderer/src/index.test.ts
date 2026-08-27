import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index';

const showcaseSource = readFileSync(
  new URL('../../../fixtures/showcase.md', import.meta.url),
  'utf8',
);

describe('renderMarkdown', () => {
  it('renders source-document text as semantic finished-document HTML', () => {
    const finishedDocument = renderMarkdown({
      source: '# Release notes\n\nThe renderer is ready.\n\n- Open a document\n- Start reading',
    });

    expect(finishedDocument.html).toContain('<h1 id="release-notes">Release notes</h1>');
    expect(finishedDocument.html).toContain('<p>The renderer is ready.</p>');
    expect(finishedDocument.html).toContain('<li>Open a document</li>');
    expect(finishedDocument.headings).toEqual([
      { id: 'release-notes', depth: 1, text: 'Release notes' },
    ]);
  });

  it('returns stable, unique heading anchors and a reusable heading structure', () => {
    const source = '# Reader\n\n## Repeated\n\n## Repeated\n\n### Child';

    const firstResult = renderMarkdown({ source });
    const secondResult = renderMarkdown({ source });

    expect(firstResult.headings).toEqual([
      { id: 'reader', depth: 1, text: 'Reader' },
      { id: 'repeated', depth: 2, text: 'Repeated' },
      { id: 'repeated-1', depth: 2, text: 'Repeated' },
      { id: 'child', depth: 3, text: 'Child' },
    ]);
    expect(secondResult).toEqual(firstResult);
  });

  it('renders the rich showcase while hiding frontmatter', () => {
    const finishedDocument = renderMarkdown({ source: showcaseSource });

    expect(finishedDocument.html).toContain('<table>');
    expect(finishedDocument.html).toContain('class="contains-task-list"');
    expect(finishedDocument.html).toContain('<del>不再需要手动 Reload</del>');
    expect(finishedDocument.html).toContain('<blockquote>');
    expect(finishedDocument.html).toContain('data-footnote-ref');
    expect(finishedDocument.html).toContain('class="footnotes"');
    expect(finishedDocument.html).toContain('class="hljs');
    expect(finishedDocument.html).toContain('data-copy-code');
    expect(finishedDocument.html).toContain('<details>');
    expect(finishedDocument.html).not.toContain('title: Fuxian renderer showcase');
    expect(finishedDocument.headings.map(({ id }) => id)).toContain('稳定标题-1');
  });

  it('keeps allowed raw HTML and removes executable content and unsafe URLs', () => {
    const finishedDocument = renderMarkdown({ source: showcaseSource });

    expect(finishedDocument.html).toContain('事件属性必须被清理。');
    expect(finishedDocument.html).toContain('<a>危险原始链接</a>');
    expect(finishedDocument.html).toContain('href="#fuxian-user-content-user-content-fn-reader"');
    expect(finishedDocument.html).not.toMatch(/<script|onclick=|onmouseover=|javascript:/i);
  });
});
