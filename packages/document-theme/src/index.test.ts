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
      '--document-inline-padding': 'clamp(32px, 5vw, 48px)',
      '--document-line-height': '1.65',
      '--document-width': '1050px',
    });
  });

  it('uses stable adaptive and A4 widths', () => {
    expect(
      getDocumentThemeVariables({ ...preferences, widthMode: 'adaptive' })['--document-width'],
    ).toBe('100%');
    expect(getDocumentThemeVariables({ ...preferences, widthMode: 'a4' })['--document-width']).toBe(
      '794px',
    );
  });

  it('keeps all content constrained by the finished-document width', () => {
    const css = createDocumentThemeCss(preferences);
    expect(css).toContain('width: min(100%, var(--document-width))');
    expect(css).toContain('padding: 72px var(--document-inline-padding) 120px');
    expect(css).toContain('--document-inline-padding: clamp(32px, 5vw, 48px)');
    expect(css).toContain('--document-width: 1050px');
    expect(css).toContain(':root[data-appearance="dark"]');
  });

  it('animates only completed formulas and diagrams with reduced-motion support', () => {
    const css = createDocumentThemeCss(preferences);

    expect(css).toContain('.render-task[data-render-state="succeeded"] > .render-task-output');
    expect(css).toContain('animation: render-task-fade-in 150ms ease-out');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).not.toMatch(/(?:^|\n)p\s*\{[^}]*animation:/);
  });

  it('keeps compact diagram controls in their own row above the graphic', () => {
    const css = createDocumentThemeCss(preferences);

    expect(css).toMatch(/\.diagram-action-toolbar\s*\{[^}]*justify-content: flex-end;/s);
    expect(css).toMatch(/\.diagram-action-toolbar\s*\{[^}]*height: 22px;/s);
    expect(css).toMatch(/\.diagram-action-button\s*\{[^}]*width: 22px;[^}]*height: 22px;/s);
    expect(css).not.toMatch(/\.diagram-action-toolbar\s*\{[^}]*position: absolute;/s);
    expect(css).not.toMatch(/var\(--document-(?:accent|surface|text)\)/);
  });

  it('constrains PlantUML diagrams without changing their aspect ratio', () => {
    const css = createDocumentThemeCss(preferences);

    expect(css).toMatch(
      /\.diagram-render-task\[data-render-task-kind="plantuml"\] svg\s*\{[^}]*width: auto;[^}]*height: auto;[^}]*max-height: calc\(100vh - 96px\);[^}]*object-fit: contain;/s,
    );
    expect(css).toMatch(
      /@media print\s*\{[\s\S]*\.diagram-render-task\[data-render-task-kind="plantuml"\] svg\s*\{[^}]*max-height: none;/,
    );
  });
});
