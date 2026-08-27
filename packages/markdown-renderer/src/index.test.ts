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
});
