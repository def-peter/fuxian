import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index';

describe('renderMarkdown', () => {
  it('renders source-document text as semantic finished-document HTML', () => {
    const finishedDocument = renderMarkdown({
      source: '# Release notes\n\nThe renderer is ready.\n\n- Open a document\n- Start reading',
    });

    expect(finishedDocument.html).toBe(
      '<h1>Release notes</h1>\n<p>The renderer is ready.</p>\n<ul>\n<li>Open a document</li>\n<li>Start reading</li>\n</ul>',
    );
  });

  it('removes unsafe URLs before returning finished-document HTML', () => {
    const finishedDocument = renderMarkdown({
      source:
        '[Safe](https://example.com)\n\n[Unsafe](javascript:alert(1))\n\n![Unsafe image](javascript:alert(2))',
    });

    expect(finishedDocument.html).toContain(
      '<a href="https://example.com" rel="noopener noreferrer" target="_blank">Safe</a>',
    );
    expect(finishedDocument.html).toContain('<a>Unsafe</a>');
    expect(finishedDocument.html).not.toContain('javascript:');
  });
});
