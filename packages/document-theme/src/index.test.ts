import { describe, expect, it } from 'vitest';
import { createDocumentThemeCss, getDocumentThemeVariables } from './index';

const preferences = {
  appearance: 'dark' as const,
  bodyFamily: 'sans-serif' as const,
  bodySize: 20,
  customWidth: 1_050,
  lineHeight: 1.65,
  widthMode: 'custom' as const,
};

describe('document theme preferences', () => {
  it('creates one document-level width and typography variable set', () => {
    expect(getDocumentThemeVariables(preferences)).toEqual({
      '--document-body-font':
        'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
      '--document-body-size': '20px',
      '--document-line-height': '1.65',
      '--document-width': '1050px',
    });
  });

  it('uses stable adaptive and A4 widths', () => {
    expect(
      getDocumentThemeVariables({ ...preferences, widthMode: 'adaptive' })['--document-width'],
    ).toBe('960px');
    expect(getDocumentThemeVariables({ ...preferences, widthMode: 'a4' })['--document-width']).toBe(
      '794px',
    );
  });

  it('keeps all content constrained by the finished-document width', () => {
    const css = createDocumentThemeCss(preferences);
    expect(css).toContain('width: min(100%, var(--document-width))');
    expect(css).toContain('--document-width: 1050px');
    expect(css).toContain(':root[data-appearance="dark"]');
  });
});
