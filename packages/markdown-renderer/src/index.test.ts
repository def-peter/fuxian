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
    expect(finishedDocument.headings.map(({ text }) => text)).not.toContain('Footnotes');
  });

  it('uses source-free pending skeletons for rendered visuals', () => {
    const finishedDocument = renderMarkdown({
      source: '```mermaid\nflowchart LR\n  A --> B\n```',
    });

    expect(finishedDocument.html).toContain('aria-busy="true"');
    expect(finishedDocument.html).toContain('class="render-task-skeleton"');
    expect(finishedDocument.html).toContain('class="render-task-skeleton-diagram"');
    expect(finishedDocument.html).toContain(
      'class="render-task-skeleton-node render-task-skeleton-node-root"',
    );
    expect(finishedDocument.html).toContain('class="render-task-source" hidden');
    expect(finishedDocument.html).not.toContain('<code class="render-task-source">flowchart LR');
  });

  it('normalizes all supported callout spellings without changing ordinary blockquotes', () => {
    const expectedTypes = {
      abstract: ['abstract', 'summary', 'tldr'],
      bug: ['bug'],
      caution: ['caution'],
      danger: ['danger', 'error'],
      example: ['example'],
      failure: ['failure', 'fail', 'missing'],
      important: ['important'],
      info: ['info'],
      note: ['note'],
      question: ['question', 'help', 'faq'],
      quote: ['quote', 'cite'],
      success: ['success', 'check', 'done'],
      tip: ['tip', 'hint'],
      todo: ['todo'],
      warning: ['warning', 'attention'],
    } as const;
    const spellings = Object.values(expectedTypes).flat();
    const source = [
      '> 普通引用不会变成 Callout。',
      '',
      ...spellings.flatMap((spelling) => [
        `> [!${spelling.toUpperCase()}]`,
        `> ${spelling} body`,
        '',
      ]),
    ].join('\n');
    const html = renderMarkdown({ source }).html;

    expect(html.match(/class="callout"/g)).toHaveLength(27);
    expect(html.match(/class="callout-icon"/g)).toHaveLength(27);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(27);
    expect(html).toContain('<blockquote>\n<p>普通引用不会变成 Callout。</p>\n</blockquote>');
    for (const [type, aliases] of Object.entries(expectedTypes)) {
      for (const alias of aliases) {
        expect(html).toContain(`data-callout-source="${alias}" data-callout-type="${type}"`);
      }
    }
  });

  it('keeps rich custom titles and nested Markdown inside semantic callouts', () => {
    const source = [
      '> [!WARNING] **发布前检查**',
      '> 请确认 [备份说明](https://example.com/backup)：',
      '>',
      '> - 已备份数据',
      '> - 已停止服务',
      '>',
      '> ```sh',
      '> pnpm test',
      '> ```',
    ].join('\n');
    const html = renderMarkdown({ source }).html;

    expect(html).toContain(
      '<blockquote class="callout" data-callout-family="risk" data-callout-source="warning" data-callout-type="warning" role="note">',
    );
    expect(html).toMatch(/<svg[^>]*class="callout-icon"/);
    expect(html).toContain('<span class="callout-title"><strong>发布前检查</strong></span>');
    expect(html).toContain('<p>请确认 <a href="https://example.com/backup"');
    expect(html).toContain('<li>已备份数据</li>');
    expect(html).toContain('class="code-block"');
    expect(html).not.toContain('[!WARNING]');
  });

  it('uses a neutral fallback for unknown callouts and leaves malformed markers untouched', () => {
    const html = renderMarkdown({
      source: [
        '> [!Architecture-Decision]',
        '> 保留未知类型的正文。',
        '',
        '> [!bad marker]',
        '> 这仍然是普通引用。',
      ].join('\n'),
    }).html;

    expect(html).toContain('data-callout-family="neutral"');
    expect(html).toContain('data-callout-source="architecture-decision"');
    expect(html).toContain('data-callout-type="note"');
    expect(html).toMatch(/<div class="callout-header"><svg[^>]*class="callout-icon"/);
    expect(html).toContain('<span class="callout-title">Architecture-Decision</span></div>');
    expect(html).toContain('<p>保留未知类型的正文。</p>');
    expect(html).toContain('<p>[!bad marker]\n这仍然是普通引用。</p>');
  });

  it('keeps allowed raw HTML and removes executable content and unsafe URLs', () => {
    const finishedDocument = renderMarkdown({ source: showcaseSource });

    expect(finishedDocument.html).toContain('事件属性必须被清理。');
    expect(finishedDocument.html).toContain('<a>危险原始链接</a>');
    expect(finishedDocument.html).toContain('href="#fuxian-user-content-user-content-fn-reader"');
    expect(finishedDocument.html).not.toMatch(/<script|onclick=|onmouseover=|javascript:/i);
  });

  it('resolves nested relative images through an opaque resource base URL', () => {
    const finishedDocument = renderMarkdown({
      resourceBaseUrl: 'fuxian-resource://document-scope/',
      source: '![Architecture](assets/diagrams/%E6%9E%B6%E6%9E%84.png "System architecture")',
    });

    expect(finishedDocument.resources).toEqual([
      {
        kind: 'image',
        source: 'assets/diagrams/%E6%9E%B6%E6%9E%84.png',
        status: 'resolved',
        url: 'fuxian-resource://document-scope/assets/diagrams/%E6%9E%B6%E6%9E%84.png',
      },
    ]);
    expect(finishedDocument.html).toContain(
      'src="fuxian-resource://document-scope/assets/diagrams/%E6%9E%B6%E6%9E%84.png"',
    );
    expect(finishedDocument.html).toContain('data-retry-resource');
    expect(finishedDocument.html).not.toContain('file://');
  });

  it('turns traversal, absolute, remote, dangerous, and unsupported images into errors', () => {
    const finishedDocument = renderMarkdown({
      resourceBaseUrl: 'fuxian-resource://document-scope/',
      source: [
        '![Traversal](../private.png)',
        '![Absolute](/tmp/private.png)',
        '![Remote](https://example.com/tracker.png)',
        '![Dangerous](javascript:alert(1))',
        '![Unsupported](assets/data.txt)',
      ].join('\n\n'),
    });

    expect(finishedDocument.resources.map((resource) => resource.status)).toEqual([
      'blocked',
      'blocked',
      'blocked',
      'blocked',
      'blocked',
    ]);
    expect(finishedDocument.html).toContain('图片路径超出了文档的授权范围。');
    expect(finishedDocument.html).toContain('只允许访问文档目录内的相对图片。');
    expect(finishedDocument.html).toContain('图片地址无效或使用了不安全的协议。');
    expect(finishedDocument.html).toContain('不支持这种图片格式。');
    expect(finishedDocument.html).not.toContain('<img');
    expect(finishedDocument.html).not.toMatch(/javascript:/i);
  });

  it('creates deterministic local render tasks for inline math, display math, and Mermaid', () => {
    const finishedDocument = renderMarkdown({
      source: [
        'Readable text appears before $E = mc^2$.',
        '',
        '$$',
        '\\int_0^1 x^2 \\, dx',
        '$$',
        '',
        '```mermaid',
        'flowchart LR',
        '  Source --> Finished["Finished <document>"]',
        '```',
      ].join('\n'),
    });

    expect(finishedDocument.renderTasks).toEqual([
      { id: 'render-task-1', kind: 'math-inline', source: 'E = mc^2' },
      { id: 'render-task-2', kind: 'math-display', source: '\\int_0^1 x^2 \\, dx' },
      {
        id: 'render-task-3',
        kind: 'mermaid',
        source: 'flowchart LR\n  Source --> Finished["Finished <document>"]\n',
      },
    ]);
    expect(finishedDocument.html).toContain('<p>Readable text appears before');
    expect(finishedDocument.html).toContain('data-render-task-kind="math-inline"');
    expect(finishedDocument.html).toContain('data-render-task-kind="math-display"');
    expect(finishedDocument.html).toContain('data-render-task-kind="mermaid"');
    expect(finishedDocument.html).toMatch(/Finished (?:&lt;|&#x3C;)document>/);
    expect(finishedDocument.html).toContain('data-retry-render-task');
    expect(finishedDocument.html).not.toMatch(/onclick=|javascript:/i);
    expect(finishedDocument.html).not.toContain('class="code-block"><figcaption');
  });

  it('creates PlantUML tasks without changing author themes or skin parameters', () => {
    const source = [
      '```plantuml',
      '@startuml',
      '!theme mars',
      'skinparam handwritten true',
      'Alice -> Bob: hello',
      '@enduml',
      '```',
    ].join('\n');
    const finishedDocument = renderMarkdown({ source });

    expect(finishedDocument.renderTasks).toEqual([
      {
        id: 'render-task-1',
        kind: 'plantuml',
        source:
          '@startuml\n!theme mars\nskinparam handwritten true\nAlice -> Bob: hello\n@enduml\n',
      },
    ]);
    expect(finishedDocument.html).toContain('aria-label="PlantUML 图表"');
    expect(finishedDocument.html).toContain('data-render-task-kind="plantuml"');
    expect(finishedDocument.html).toContain('!theme mars');
    expect(finishedDocument.html).toContain('skinparam handwritten true');
  });

  it('creates Vega-Lite visualization tasks only for the canonical fence name', () => {
    const specification = '{"data":{"values":[]},"mark":"bar"}';
    const finishedDocument = renderMarkdown({
      source: ['```vega-lite', specification, '```', '', '```vegalite', specification, '```'].join(
        '\n',
      ),
    });

    expect(finishedDocument.renderTasks).toEqual([
      { id: 'render-task-1', kind: 'vega-lite', source: `${specification}\n` },
    ]);
    expect(finishedDocument.html).toContain('aria-label="Vega-Lite 数据图表"');
    expect(finishedDocument.html).toContain('data-render-task-kind="vega-lite"');
    expect(finishedDocument.html).toContain('language-vegalite');
  });

  it('creates AntV Infographic tasks only for the canonical fence name', () => {
    const source = [
      'infographic list-row-simple-horizontal-arrow',
      'data',
      '  lists',
      '    - label 需求确认',
    ].join('\n');
    const finishedDocument = renderMarkdown({
      source: ['```infographic', source, '```', '', '```antv-infographic', source, '```'].join(
        '\n',
      ),
    });

    expect(finishedDocument.renderTasks).toEqual([
      { id: 'render-task-1', kind: 'infographic', source: `${source}\n` },
    ]);
    expect(finishedDocument.html).toContain('aria-label="AntV Infographic 信息图"');
    expect(finishedDocument.html).toContain('data-render-task-kind="infographic"');
    expect(finishedDocument.html).toContain('language-antv-infographic');
  });

  it('highlights common Python, JavaScript, and Java code fences', () => {
    const html = renderMarkdown({
      source: [
        '```python',
        'def greet(name):',
        '    return f"Hello {name}"',
        '```',
        '',
        '```javascript',
        'const result = await fetch(url);',
        '```',
        '',
        '```java',
        'public class Main { private final int value = 1; }',
        '```',
      ].join('\n'),
    }).html;

    expect(html.match(/class="hljs language-/g)).toHaveLength(3);
    expect(html).toContain('class="hljs-keyword"');
    expect(html).toContain('class="hljs-string"');
    expect(html).toContain('class="hljs-title class_"');
  });

  it('keeps Markmap fences as ordinary code blocks', () => {
    const source = '# 浮现\n## 快速阅读\n- Markdown\n- PDF';
    const finishedDocument = renderMarkdown({
      source: ['```markmap', source, '```'].join('\n'),
    });

    expect(finishedDocument.renderTasks).toEqual([]);
    expect(finishedDocument.html).toContain('language-markmap');
    expect(finishedDocument.html).toContain('快速阅读');
  });
});
