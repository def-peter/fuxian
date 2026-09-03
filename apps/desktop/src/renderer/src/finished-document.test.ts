import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseHTML } from 'linkedom';
import { applyDocumentTheme, prepareRenderedVisualSvg } from './finished-document';

describe('finished document theme', () => {
  it('waits for an iframe document element before applying the theme', () => {
    const loadingDocument = { documentElement: null } as unknown as Document;

    expect(() =>
      applyDocumentTheme(loadingDocument, {
        appearance: 'light',
        bodyFamily: 'serif',
        bodySize: 17,
        codeTheme: 'github-dark',
        customWidth: 860,
        lineHeight: 1.85,
        widthMode: 'adaptive',
      }),
    ).not.toThrow();
  });

  it('applies code themes independently from document appearance', () => {
    const frameDocument = parseHTML('<!doctype html><html><body></body></html>')
      .document as unknown as Document;

    applyDocumentTheme(frameDocument, {
      appearance: 'light',
      bodyFamily: 'sans-serif',
      bodySize: 15,
      codeTheme: 'github-dark',
      customWidth: 860,
      lineHeight: 1.85,
      widthMode: 'adaptive',
    });

    expect(frameDocument.documentElement.dataset.appearance).toBe('light');
    expect(frameDocument.documentElement.dataset.codeTheme).toBe('github-dark');
  });
});

describe('rendered visual preparation', () => {
  const frameDocument = (): Document => new JSDOM('<!doctype html>').window.document;

  it('preserves only the official Infographic text structure and reviewed styles', () => {
    const svg = prepareRenderedVisualSvg(
      frameDocument(),
      [
        '<svg xmlns="http://www.w3.org/2000/svg">',
        '<foreignObject x="0" y="0" width="120" height="40" overflow="visible" onclick="bad()">',
        '<span xmlns="http://www.w3.org/1999/xhtml" data-secret="x" style="display:flex;color:#262626;position:fixed;background-image:url(https://example.test/x);white-space:pre-wrap">中文标题</span>',
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
    const style = span?.getAttribute('style') ?? '';
    expect(style).toMatch(/display:\s*flex/iu);
    expect(style).toMatch(/color:\s*(?:#262626|rgb\(38,\s*38,\s*38\))/iu);
    expect(style).toMatch(/white-space:\s*pre-wrap/iu);
    expect(style).not.toMatch(/position|background|url/iu);
    expect(span?.hasAttribute('data-secret')).toBe(false);
    expect(svg.innerHTML).not.toMatch(/onclick|script|example\.test/iu);
  });

  it('continues to remove foreignObject from other rendered visuals', () => {
    const svg = prepareRenderedVisualSvg(
      frameDocument(),
      '<svg><foreignObject><span>hidden</span></foreignObject><text>kept</text></svg>',
      'mermaid',
    );

    expect(svg.querySelector('foreignObject')).toBeNull();
    expect(svg.querySelector('text')?.textContent).toBe('kept');
  });

  it('preserves Mermaid styles and author attributes without inventing replacements', () => {
    const svg = prepareRenderedVisualSvg(
      frameDocument(),
      [
        '<svg>',
        '<style>.flowchart-link{stroke:#718096;fill:none}.arrow{marker-end:url(#arrow)}</style>',
        '<g class="node"><g class="label"><text>居中节点</text></g></g>',
        '<g class="node"><g class="label"><text text-anchor="end">作者对齐</text></g></g>',
        '<path class="flowchart-link arrow" onclick="bad()" d="M0 0 C10 20 20 20 30 0" />',
        '<path class="flowchart-link" fill="#123456" d="M0 0 L30 0" />',
        '<g class="edgeLabel"><rect class="background" /></g>',
        '<g class="edgeLabel"><rect class="background" fill="#abcdef" /></g>',
        '<marker id="arrow"><path d="M0 0 L10 5 L0 10 Z" /></marker>',
        '<use href="#arrow" /><use href="https://example.test/external.svg#icon" />',
        '</svg>',
      ].join(''),
      'mermaid',
    );

    const labels = svg.querySelectorAll('g.node g.label text');
    expect(labels[0]?.hasAttribute('text-anchor')).toBe(false);
    expect(labels[1]?.getAttribute('text-anchor')).toBe('end');
    const edges = svg.querySelectorAll('path.flowchart-link');
    expect(edges[0]?.hasAttribute('fill')).toBe(false);
    expect(edges[0]?.hasAttribute('onclick')).toBe(false);
    expect(edges[1]?.getAttribute('fill')).toBe('#123456');
    const backgrounds = svg.querySelectorAll('g.edgeLabel rect.background');
    expect(backgrounds[0]?.hasAttribute('fill')).toBe(false);
    expect(backgrounds[1]?.getAttribute('fill')).toBe('#abcdef');
    expect(svg.querySelector('marker path')?.hasAttribute('fill')).toBe(false);
    expect(svg.querySelector('style')?.textContent).toContain('marker-end:url(#arrow)');
    const uses = svg.querySelectorAll('use');
    expect(uses[0]?.getAttribute('href')).toBe('#arrow');
    expect(uses[1]?.hasAttribute('href')).toBe(false);
  });
});
