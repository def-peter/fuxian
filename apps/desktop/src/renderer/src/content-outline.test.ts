import type { DocumentHeading } from '@fuxian/markdown-renderer';
import { describe, expect, it } from 'vitest';
import { buildContentOutline } from './content-outline-model';

describe('buildContentOutline', () => {
  it('keeps repeated headings distinct and preserves skipped-depth nesting', () => {
    const headings: DocumentHeading[] = [
      { depth: 1, id: 'guide', text: 'Guide' },
      { depth: 2, id: 'stable-heading', text: 'Stable heading' },
      { depth: 4, id: 'deep-heading', text: 'Deep heading' },
      { depth: 2, id: 'stable-heading-1', text: 'Stable heading' },
    ];

    expect(buildContentOutline(headings)).toEqual([
      {
        children: [
          {
            children: [{ children: [], heading: headings[2] }],
            heading: headings[1],
          },
          { children: [], heading: headings[3] },
        ],
        heading: headings[0],
      },
    ]);
  });
});
