import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index';

const skillRoot = new URL('../../../skill/fuxian-diagram-authoring/', import.meta.url);

describe('Fuxian diagram authoring skill contract', () => {
  it('keeps every published minimal example aligned with recognized render tasks', () => {
    const syntax = readFileSync(new URL('references/fence-syntax.md', skillRoot), 'utf8');
    const examples = [...syntax.matchAll(/````markdown\n([\s\S]*?)\n````/gu)].map(
      ([, markdown]) => markdown ?? '',
    );
    const kinds = examples.flatMap((source) =>
      renderMarkdown({ source }).renderTasks.map((task) => task.kind),
    );

    expect(kinds).toEqual(['mermaid', 'plantuml', 'vega-lite', 'infographic']);
  });

  it('records D2 and Markmap as unsupported document fences', () => {
    const capabilities = readFileSync(new URL('references/capabilities.md', skillRoot), 'utf8');

    expect(capabilities).toMatch(/\| D2\s+\| none\s+\|[\s\S]*?Unsupported;/u);
    expect(capabilities).toMatch(/\| Markmap\s+\| none\s+\|[\s\S]*?Unsupported as document/u);
    expect(
      renderMarkdown({
        source: '```d2\na -> b\n```\n\n```markmap\n# A\n## B\n```',
      }).renderTasks,
    ).toEqual([]);
  });
});
