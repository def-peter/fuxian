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

const markdownProcessor = unified().use(remarkParse).use(remarkRehype).use(rehypeStringify);

export function renderMarkdown({ source }: RenderMarkdownInput): FinishedDocument {
  return {
    html: markdownProcessor.processSync(source).toString(),
  };
}
