import type { DocumentHeading } from '@fuxian/markdown-renderer';

export interface ContentOutlineNode {
  children: ContentOutlineNode[];
  heading: DocumentHeading;
}

export const buildContentOutline = (headings: DocumentHeading[]): ContentOutlineNode[] => {
  const roots: ContentOutlineNode[] = [];
  const stack: ContentOutlineNode[] = [];

  for (const heading of headings) {
    const node: ContentOutlineNode = { children: [], heading };
    while ((stack.at(-1)?.heading.depth ?? 0) >= heading.depth) {
      stack.pop();
    }

    const parent = stack.at(-1);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack.push(node);
  }

  return roots;
};

export const findOutlinePath = (
  nodes: ContentOutlineNode[],
  headingId: string,
  parents: ContentOutlineNode[] = [],
): ContentOutlineNode[] | undefined => {
  for (const node of nodes) {
    const path = [...parents, node];
    if (node.heading.id === headingId) {
      return path;
    }

    const childPath = findOutlinePath(node.children, headingId, path);
    if (childPath) {
      return childPath;
    }
  }
  return undefined;
};
