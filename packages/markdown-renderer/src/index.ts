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
  resourceBaseUrl?: string;
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
  resources: DocumentResource[];
}

export type DocumentResourceError =
  'invalid-url' | 'path-traversal' | 'unsupported-format' | 'unauthorized';

export type DocumentResource =
  | { kind: 'image'; source: string; status: 'resolved'; url: string }
  | { kind: 'image'; source: string; status: 'blocked'; error: DocumentResourceError };

const rawHtmlIdPrefix = 'fuxian-user-content-';
const supportedImageExtensions = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
]);

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

const blockedImageMessages: Record<DocumentResourceError, string> = {
  'invalid-url': '图片地址无效或使用了不安全的协议。',
  'path-traversal': '图片路径超出了文档的授权范围。',
  'unsupported-format': '不支持这种图片格式。',
  unauthorized: '只允许访问文档目录内的相对图片。',
};

type ImageResourceResolution =
  { status: 'resolved'; url: string } | { status: 'blocked'; error: DocumentResourceError };

const resolveImageResource = (
  source: string,
  resourceBaseUrl: string | undefined,
): ImageResourceResolution => {
  const trimmedSource = source.trim();
  if (!trimmedSource) {
    return { status: 'blocked', error: 'invalid-url' };
  }

  if (
    !resourceBaseUrl ||
    /^[a-z][a-z\d+.-]*:/i.test(trimmedSource) ||
    /^(?:[/\\]|[a-z]:[/\\])/i.test(trimmedSource)
  ) {
    return { status: 'blocked', error: 'unauthorized' };
  }

  const pathPart = trimmedSource.split(/[?#]/, 1)[0] ?? '';
  for (const rawSegment of pathPart.split('/')) {
    let segment: string;
    try {
      segment = decodeURIComponent(rawSegment);
    } catch {
      return { status: 'blocked', error: 'invalid-url' };
    }

    if (
      segment === '..' ||
      segment.includes('/') ||
      segment.includes('\\') ||
      segment.includes('\0')
    ) {
      return { status: 'blocked', error: 'path-traversal' };
    }
  }

  try {
    const baseUrl = new URL(resourceBaseUrl);
    const resolvedUrl = new URL(trimmedSource, baseUrl);
    if (
      baseUrl.protocol !== 'fuxian-resource:' ||
      resolvedUrl.protocol !== baseUrl.protocol ||
      resolvedUrl.host !== baseUrl.host
    ) {
      return { status: 'blocked', error: 'unauthorized' };
    }

    const pathname = resolvedUrl.pathname.toLowerCase();
    const extension = [...supportedImageExtensions].find((candidate) =>
      pathname.endsWith(candidate),
    );
    if (!extension) {
      return { status: 'blocked', error: 'unsupported-format' };
    }

    return { status: 'resolved', url: resolvedUrl.toString() };
  } catch {
    return { status: 'blocked', error: 'invalid-url' };
  }
};

const createResourceError = (
  source: string,
  message: string,
  retryable: boolean,
  hidden: boolean,
): Element => ({
  type: 'element',
  tagName: 'span',
  properties: {
    ariaLive: 'polite',
    className: ['resource-error'],
    ...(hidden ? { hidden: true } : {}),
  },
  children: [
    {
      type: 'element',
      tagName: 'strong',
      properties: { className: ['resource-error-title'] },
      children: [{ type: 'text', value: '无法加载图片' }],
    },
    {
      type: 'element',
      tagName: 'span',
      properties: { className: ['resource-error-detail'] },
      children: [{ type: 'text', value: message }],
    },
    ...(source
      ? [
          {
            type: 'element' as const,
            tagName: 'code',
            properties: { className: ['resource-error-source'] },
            children: [{ type: 'text' as const, value: source }],
          },
        ]
      : []),
    ...(retryable
      ? [
          {
            type: 'element' as const,
            tagName: 'button',
            properties: {
              className: ['resource-retry-button'],
              dataRetryResource: '',
              type: 'button',
            },
            children: [{ type: 'text' as const, value: '重试' }],
          },
        ]
      : []),
  ],
});

interface TransformDocumentImagesOptions {
  resourceBaseUrl: string | undefined;
  resources: DocumentResource[];
}

const transformDocumentImages: Plugin<[TransformDocumentImagesOptions], Root> =
  ({ resourceBaseUrl, resources }) =>
  (tree) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'img' || index === undefined || !parent) {
        return;
      }

      const source = typeof node.properties.src === 'string' ? node.properties.src : '';
      const resolution = resolveImageResource(source, resourceBaseUrl);
      resources.push({ kind: 'image', source, ...resolution });

      let resourceNode: Element;
      if (resolution.status === 'resolved') {
        const alt = typeof node.properties.alt === 'string' ? node.properties.alt : '';
        const title = typeof node.properties.title === 'string' ? node.properties.title : undefined;
        resourceNode = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['document-image'], dataResourceSource: source },
          children: [
            {
              type: 'element',
              tagName: 'img',
              properties: {
                alt,
                dataResourceUrl: resolution.url,
                decoding: 'async',
                loading: 'lazy',
                src: resolution.url,
                ...(title ? { title } : {}),
              },
              children: [],
            },
            createResourceError(source, '请确认图片存在且文件内容完整。', true, true),
          ],
        };
      } else {
        resourceNode = {
          type: 'element',
          tagName: 'span',
          properties: {
            className: ['document-image', 'document-image-error'],
            dataResourceSource: source,
          },
          children: [
            createResourceError(source, blockedImageMessages[resolution.error], false, false),
          ],
        };
      }

      parent.children[index] = resourceNode;
      return SKIP;
    });
  };

const collectHeadingStructure: Plugin<[], Root> = () => (tree, file) => {
  const headings: DocumentHeading[] = [];

  visit(tree, 'element', (node) => {
    const match = /^h([1-6])$/.exec(node.tagName);
    const classNames = node.properties.className;
    if (
      !match ||
      typeof node.properties.id !== 'string' ||
      (Array.isArray(classNames) && classNames.includes('sr-only'))
    ) {
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

const createMarkdownProcessor = (imageOptions: TransformDocumentImagesOptions) =>
  unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(hideFrontmatter)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, finishedDocumentSchema)
    .use(alignSanitizedFragmentLinks)
    .use(transformDocumentImages, imageOptions)
    .use(rehypeSlug)
    .use(rehypeHighlight, { detect: false })
    .use(rehypeExternalLinks, {
      rel: ['noopener', 'noreferrer'],
      target: '_blank',
    })
    .use(enhanceCodeBlocks)
    .use(collectHeadingStructure)
    .use(rehypeStringify);

export function renderMarkdown({ resourceBaseUrl, source }: RenderMarkdownInput): FinishedDocument {
  const resources: DocumentResource[] = [];
  const result = createMarkdownProcessor({ resourceBaseUrl, resources }).processSync(source);

  return {
    html: result.toString(),
    headings: (result.data['headings'] as DocumentHeading[] | undefined) ?? [],
    resources,
  };
}
