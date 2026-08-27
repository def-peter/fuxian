import type { Element, Root } from 'hast';
import { toText } from 'hast-util-to-text';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import type { Root as MarkdownRoot } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { type Plugin, unified } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

export interface RenderMarkdownInput {
  source: string;
}

export interface DocumentHeading {
  id: string;
  depth: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface FinishedDocument {
  html: string;
  headings: DocumentHeading[];
}

const rawHtmlIdPrefix = 'fuxian-user-content-';

const finishedDocumentSchema: SanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: rawHtmlIdPrefix,
  protocols: {
    ...defaultSchema.protocols,
    href: ['http', 'https'],
    src: ['http', 'https'],
  },
};

const alignSanitizedFragmentLinks: Plugin<[], Root> = () => (tree) => {
  const sanitizedIds = new Set<string>();

  visit(tree, 'element', (node) => {
    if (typeof node.properties.id === 'string') {
      sanitizedIds.add(node.properties.id);
    }
  });

  visit(tree, 'element', (node) => {
    const href = node.properties.href;
    if (node.tagName !== 'a' || typeof href !== 'string' || !href.startsWith('#')) {
      return;
    }

    const sanitizedTarget = `${rawHtmlIdPrefix}${href.slice(1)}`;
    if (sanitizedIds.has(sanitizedTarget)) {
      node.properties.href = `#${sanitizedTarget}`;
    }
  });
};

const hideFrontmatter: Plugin<[], MarkdownRoot> = () => (tree) => {
  tree.children = tree.children.filter((node) => node.type !== 'yaml');
};

const collectHeadingStructure: Plugin<[], Root> = () => (tree, file) => {
  const headings: DocumentHeading[] = [];

  visit(tree, 'element', (node) => {
    const match = /^h([1-6])$/.exec(node.tagName);
    if (!match || typeof node.properties.id !== 'string') {
      return;
    }

    headings.push({
      id: node.properties.id,
      depth: Number(match[1]) as DocumentHeading['depth'],
      text: toText(node),
    });
  });

  file.data['headings'] = headings;
};

const enhanceCodeBlocks: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node, index, parent) => {
    if (node.tagName !== 'pre' || index === undefined || !parent) {
      return;
    }

    const code = node.children.find(
      (child): child is Element => child.type === 'element' && child.tagName === 'code',
    );
    if (!code) {
      return;
    }

    const languageClass = code.properties.className?.find(
      (className): className is string =>
        typeof className === 'string' && className.startsWith('language-'),
    );
    const language = languageClass?.slice('language-'.length) || 'text';

    const codeBlock: Element = {
      type: 'element',
      tagName: 'figure',
      properties: { className: ['code-block'] },
      children: [
        {
          type: 'element',
          tagName: 'figcaption',
          properties: { className: ['code-toolbar'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['code-language'] },
              children: [{ type: 'text', value: language }],
            },
            {
              type: 'element',
              tagName: 'button',
              properties: {
                ariaLabel: '复制代码',
                className: ['code-copy-button'],
                dataCopyCode: '',
                type: 'button',
              },
              children: [{ type: 'text', value: '复制' }],
            },
          ],
        },
        node,
      ],
    };

    parent.children[index] = codeBlock;
    return SKIP;
  });
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(hideFrontmatter)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeSanitize, finishedDocumentSchema)
  .use(alignSanitizedFragmentLinks)
  .use(rehypeSlug)
  .use(rehypeHighlight, { detect: false })
  .use(rehypeExternalLinks, {
    rel: ['noopener', 'noreferrer'],
    target: '_blank',
  })
  .use(enhanceCodeBlocks)
  .use(collectHeadingStructure)
  .use(rehypeStringify);

export function renderMarkdown({ source }: RenderMarkdownInput): FinishedDocument {
  const result = markdownProcessor.processSync(source);

  return {
    html: result.toString(),
    headings: (result.data['headings'] as DocumentHeading[] | undefined) ?? [],
  };
}
