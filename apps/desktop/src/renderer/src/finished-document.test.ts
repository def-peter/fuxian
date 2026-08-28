import { describe, expect, it } from 'vitest';
import { parseHTML } from 'linkedom';
import { applyDocumentTheme, sanitizeRenderedVisualSvg } from './finished-document';

describe('finished document theme', () => {
  it('waits for an iframe document element before applying the theme', () => {
    const loadingDocument = { documentElement: null } as unknown as Document;

    expect(() =>
      applyDocumentTheme(loadingDocument, {
        appearance: 'light',
        bodyFamily: 'serif',
        bodySize: 17,
        customWidth: 860,
        lineHeight: 1.85,
        widthMode: 'adaptive',
      }),
    ).not.toThrow();
  });
});

describe('rendered visual sanitizer', () => {
  const frameDocument = (): Document =>
    parseHTML('<!doctype html><html><body></body></html>').document as unknown as Document;

  it('preserves only the official Infographic text structure and reviewed styles', () => {
    const svg = sanitizeRenderedVisualSvg(
      frameDocument(),
      [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<foreignObject x="0" y="0" width="120" height="40" overflow="visible" onclick="bad()">',
        '<span xmlns="http://www.w3.org/1999/xhtml" data-secret="x" style="display:flex;color:#262626;position:fixed;background:url(https://example.test/x);white-space:pre-wrap">中文标题</span>',
        '</foreignObject>',
        '<foreignObject><div>不允许的 HTML</div></foreignObject>',
        '<script>alert(1)</script>',
        '</svg>',
      ].join(''),
      'infographic',
    );

    expect(svg.querySelectorAll('foreignObject')).toHaveLength(1);
    const span = svg.querySelector('foreignObject > span') as HTMLElement | null;
    expect(span?.textContent).toBe('中文标题');
    expect(span?.getAttribute('style')).toContain('display:flex');
    expect(span?.getAttribute('style')).toContain('color:#262626');
    expect(span?.getAttribute('style')).toContain('white-space:pre-wrap');
    expect(span?.getAttribute('style')).not.toMatch(/position|background|url/iu);
    expect(span?.hasAttribute('data-secret')).toBe(false);
    expect(svg.innerHTML).not.toMatch(/onclick|script|example\.test/iu);
  });

  it('continues to remove foreignObject from other rendered visuals', () => {
    const svg = sanitizeRenderedVisualSvg(
      frameDocument(),
      '<svg><foreignObject><span>hidden</span></foreignObject><text>kept</text></svg>',
      'mermaid',
    );

    expect(svg.querySelector('foreignObject')).toBeNull();
    expect(svg.querySelector('text')?.textContent).toBe('kept');
  });
});
