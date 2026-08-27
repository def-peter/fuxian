import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

export interface RenderMarkdownInput {
  source: string;
}

export interface FinishedDocument {
  html: string;
}

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeExternalLinks, {
    rel: ['noopener', 'noreferrer'],
    target: '_blank',
  })
  .use(rehypeStringify);

export function renderMarkdown({ source }: RenderMarkdownInput): FinishedDocument {
  return {
    html: markdownProcessor.processSync(source).toString(),
  };
}
