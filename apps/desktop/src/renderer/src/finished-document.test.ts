import { describe, expect, it } from 'vitest';
import { applyDocumentTheme } from './finished-document';

describe('finished document theme', () => {
  it('waits for an iframe document element before applying the theme', () => {
    const loadingDocument = { documentElement: null } as unknown as Document;

    expect(() =>
      applyDocumentTheme(loadingDocument, {
        appearance: 'light',
        bodyFamily: 'serif',
        bodySize: 17,
        customWidth: 860,
        lineHeight: 1.85,
        widthMode: 'adaptive',
      }),
    ).not.toThrow();
  });
});
