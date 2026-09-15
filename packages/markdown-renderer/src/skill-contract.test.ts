import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './index';

const skillRoot = new URL('../../../skills/fuxian-diagram/', import.meta.url);
const guideExamples = readdirSync(skillRoot, { recursive: true, encoding: 'utf8' })
  .filter((path) => path.endsWith('.md'))
  .sort()
  .flatMap((path) => {
    const guide = readFileSync(new URL(path.replaceAll('\\', '/'), skillRoot), 'utf8');
    return [
      ...guide.matchAll(/^```(mermaid|plantuml|vega-lite|infographic)\n([\s\S]*?)^```$/gmu),
    ].map(([markdown, kind, source], index) => ({
      path,
      index: index + 1,
      markdown,
      kind,
      source,
    }));
  });

describe('Fuxian diagram authoring skill contract', () => {
  it.each(guideExamples)(
    'recognizes the complete example $index in $path',
    ({ markdown, kind, source }) => {
      const tasks = renderMarkdown({ source: markdown }).renderTasks;

      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.kind).toBe(kind);
      expect(tasks[0]?.source.trim()).toBe(source?.trim());
    },
  );

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
