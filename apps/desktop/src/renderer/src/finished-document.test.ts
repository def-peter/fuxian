import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { parseHTML } from 'linkedom';
import {
  applyDocumentTheme,
  isolateRenderedVisualSvgIds,
  prepareRenderedVisualSvg,
} from './finished-document';

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
        '<span xmlns="http://www.w3.org/1999/xhtml" data-secret="x" style="display:flex;color:#262626;font-family:system-ui;text-decoration:underline;position:fixed;background-image:url(https://example.test/x);white-space:pre-wrap">中文标题</span>',
        '</foreignObject>',
        '<foreignObject><div>不允许的 HTML</div></foreignObject>',
        '<path><animate attributeName="stroke-dashoffset" from="12" to="0" dur="1.2s" repeatCount="indefinite" /></path>',
        '<path><animate attributeName="href" from="#safe" to="https://example.test/x" dur="1s" repeatCount="indefinite" /></path>',
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
    expect(style).toMatch(/font-family:\s*system-ui/iu);
    expect(style).toMatch(/text-decoration:\s*underline/iu);
    expect(style).toMatch(/white-space:\s*pre-wrap/iu);
    expect(style).not.toMatch(/position|background|url/iu);
    expect(span?.hasAttribute('data-secret')).toBe(false);
    expect(svg.querySelectorAll('animate')).toHaveLength(1);
    expect(svg.querySelector('animate')?.getAttribute('attributeName')).toBe('stroke-dashoffset');
    expect(svg.innerHTML).not.toMatch(/onclick|script|example\.test/iu);
  });

  it('continues to remove foreignObject from other rendered visuals', () => {
    const svg = prepareRenderedVisualSvg(
      frameDocument(),
      '<svg><foreignObject><span>hidden</span></foreignObject><text>kept</text></svg>',
      'plantuml',
    );

    expect(svg.querySelector('foreignObject')).toBeNull();
    expect(svg.querySelector('text')?.textContent).toBe('kept');
  });

  it('preserves Mermaid HTML labels, wrapping and emphasis while removing active content', () => {
    const svg = prepareRenderedVisualSvg(
      frameDocument(),
      `<svg xmlns="http://www.w3.org/2000/svg"><g class="label" transform="translate(-48,-12)">
        <foreignObject width="96" height="48"><div xmlns="http://www.w3.org/1999/xhtml" style="display:table-cell;white-space:normal;max-width:96px;text-align:center;position:fixed;background-image:url(https://example.test/style)">
          <span class="nodeLabel" style="font-size:99px"><p><strong>客户</strong><br/><em>明早到访</em></p></span>
          <script>alert(1)</script><iframe src="https://example.test"></iframe>
          <img src="https://example.test/x" onerror="bad()"/><input autofocus="" onfocus="bad()"/>
          <a href="javascript:bad()" onclick="bad()">链接文字</a>
        </div></foreignObject></g></svg>`,
      'mermaid',
    );
    expect(svg.querySelector('foreignObject')?.getAttribute('width')).toBe('96');
    expect(svg.querySelector('div')?.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect((svg.querySelector('div') as HTMLElement | null)?.style.maxWidth).toBe('96px');
    expect(svg.querySelector('div')?.getAttribute('style')).not.toMatch(/position|background|url/u);
    expect(svg.querySelector('span')?.hasAttribute('style')).toBe(false);
    expect(svg.querySelector('strong')?.textContent).toBe('客户');
    expect(svg.querySelector('em')?.textContent).toBe('明早到访');
    expect(svg.querySelector('br')).not.toBeNull();
    expect(svg.querySelector('g')?.getAttribute('transform')).toBe('translate(-48,-12)');
    expect(svg.querySelector('script, iframe, img, input, a')).toBeNull();
    expect(svg.outerHTML).not.toMatch(
      /onerror|onclick|onfocus|javascript:|position|background|url|example\.test/u,
    );
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

  it('isolates SVG IDs and their local references across visual blocks', () => {
    const document = frameDocument();
    const source = [
      '<svg xmlns="http://www.w3.org/2000/svg">',
      '<defs><clipPath id="clip1"><rect width="18" height="54" /></clipPath>',
      '<filter id="shadow" /><mask id="fade" /><marker id="arrow" /></defs>',
      '<title id="label">Chart</title>',
      '<style>#label{font-weight:bold}.bar{clip-path:url(#clip1);marker-end:url("#arrow")}</style>',
      '<g aria-labelledby="label" clip-path="url(#clip1)" filter="url(#shadow)" mask="url(#fade)">',
      '<use href="#arrow"/><path class="bar" data-vega-tooltip="url(#clip1)" style="fill:url(#fade)" d="M0 0H540V54H0Z" /></g>',
      '</svg>',
    ].join('');
    const first = prepareRenderedVisualSvg(document, source, 'vega-lite');
    const second = prepareRenderedVisualSvg(document, source, 'vega-lite');
    isolateRenderedVisualSvgIds(first);
    isolateRenderedVisualSvgIds(second);
    document.body.append(first, second);

    const firstClip = first.querySelector('clipPath')?.id;
    const secondClip = second.querySelector('clipPath')?.id;
    expect(firstClip).toBeTruthy();
    expect(secondClip).toBeTruthy();
    expect(firstClip).not.toBe(secondClip);
    expect(second.querySelector('g')?.getAttribute('clip-path')).toBe(`url(#${secondClip})`);
    expect(second.querySelector('g')?.getAttribute('filter')).toBe(
      `url(#${second.querySelector('filter')?.id})`,
    );
    expect(second.querySelector('g')?.getAttribute('mask')).toBe(
      `url(#${second.querySelector('mask')?.id})`,
    );
    expect(second.querySelector('use')?.getAttribute('href')).toBe(
      `#${second.querySelector('marker')?.id}`,
    );
    expect(second.querySelector('g')?.getAttribute('aria-labelledby')).toBe(
      second.querySelector('title')?.id,
    );
    expect(second.querySelector('style')?.textContent).toContain(`url(#${secondClip})`);
    expect(second.querySelector('style')?.textContent).toContain(
      `#${second.querySelector('title')?.id}`,
    );
    expect(second.querySelector('style')?.textContent).toContain(
      `url(#${second.querySelector('marker')?.id})`,
    );
    expect(second.querySelector('path.bar')?.getAttribute('style')).toBe(
      `fill:url(#${second.querySelector('mask')?.id})`,
    );
    expect(second.querySelector('path.bar')?.getAttribute('data-vega-tooltip')).toBe('url(#clip1)');
  });

  it('keeps references on the first definition when a source SVG repeats an ID', () => {
    const svg = prepareRenderedVisualSvg(
      frameDocument(),
      '<svg><defs><clipPath id="clip"><rect width="18"/></clipPath><clipPath id="clip"><rect width="540"/></clipPath></defs><rect clip-path="url(#clip)"/></svg>',
      'vega-lite',
    );
    isolateRenderedVisualSvgIds(svg);
    const firstClip = svg.querySelector('clipPath');
    expect(svg.querySelector('rect[clip-path]')?.getAttribute('clip-path')).toBe(
      `url(#${firstClip?.id})`,
    );
  });

  it('rewrites escaped local CSS references and animation names', () => {
    const document = frameDocument();
    const source = String.raw`<svg><defs><clipPath id="clip"><rect width="18"/></clipPath><filter id="filter"/></defs>
      <style>@keyframes pulse{from{opacity:.2}to{opacity:.8}}.bar{clip-path:url(#cli\70);animation:pulse 1s infinite}</style>
      <rect class="bar" clip-path="url(#cli\70)" style="filter:url(#fil\74 er);animation-name:pulse"/></svg>`;
    const first = prepareRenderedVisualSvg(document, source, 'plantuml');
    const second = prepareRenderedVisualSvg(document, source, 'plantuml');
    isolateRenderedVisualSvgIds(first);
    isolateRenderedVisualSvgIds(second);

    const firstStyle = first.querySelector('style')?.textContent ?? '';
    const secondStyle = second.querySelector('style')?.textContent ?? '';
    const firstAnimation = /@keyframes ([\w-]+)/u.exec(firstStyle)?.[1];
    const secondAnimation = /@keyframes ([\w-]+)/u.exec(secondStyle)?.[1];
    expect(firstAnimation).toBeTruthy();
    expect(secondAnimation).toBeTruthy();
    expect(firstAnimation).not.toBe(secondAnimation);
    expect(secondStyle).toContain(`animation:${secondAnimation} 1s infinite`);
    expect(secondStyle).toContain(`url(#${second.querySelector('clipPath')?.id})`);
    expect(second.querySelector('rect.bar')?.getAttribute('clip-path')).toBe(
      `url(#${second.querySelector('clipPath')?.id})`,
    );
    expect(second.querySelector('rect.bar')?.getAttribute('style')).toContain(
      `url(#${second.querySelector('filter')?.id})`,
    );
    expect(second.querySelector('rect.bar')?.getAttribute('style')).toContain(
      `animation-name:${secondAnimation}`,
    );
  });
});
