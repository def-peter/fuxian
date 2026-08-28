import type { DocumentHeading } from '@fuxian/markdown-renderer';
import type { IPureNode } from 'markmap-common';
import { buildContentOutline, type ContentOutlineNode } from './content-outline-model';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const toMindMapNode = (node: ContentOutlineNode): IPureNode => ({
  children: node.children.map(toMindMapNode),
  content: escapeHtml(node.heading.text),
});

const documentLabel = (name: string): string =>
  name.replace(/\.(?:markdown|md)$/iu, '') || '文章结构';

export const buildArticleStructureMap = (
  headings: DocumentHeading[],
  documentName: string,
): IPureNode | undefined => {
  const roots = buildContentOutline(headings).map(toMindMapNode);
  if (roots.length === 0) return undefined;
  if (roots.length === 1) return roots[0];
  return { children: roots, content: escapeHtml(documentLabel(documentName)) };
};
