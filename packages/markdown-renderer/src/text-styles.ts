import { generate, lexer, parse } from 'css-tree';
import type { Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

// Author text colors are content. Layout, resource-loading declarations and
// application CSS variables are not part of inline text formatting.
export const preserveTextStyles: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (node) => {
    const style = node.properties.style;
    delete node.properties.style;
    if (typeof style !== 'string') return;
    try {
      const declarations = parse(style, { context: 'declarationList' });
      if (declarations.type !== 'DeclarationList') return;
      const retained: string[] = [];
      declarations.children.forEach((declaration) => {
        if (declaration.type !== 'Declaration') return;
        const property = declaration.property.toLowerCase();
        if (property !== 'color' && property !== 'background-color') return;
        if (!lexer.matchProperty(property, declaration.value).matched) return;
        retained.push(
          `${property}:${generate(declaration.value)}${declaration.important ? '!important' : ''}`,
        );
      });
      if (retained.length) node.properties.style = retained.join(';');
    } catch {
      // Malformed CSS must not prevent the surrounding Markdown from rendering.
    }
  });
};
