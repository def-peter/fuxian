export interface DocumentThemePreferences {
  appearance: 'dark' | 'light';
  bodyFamily: 'sans-serif' | 'serif';
  bodySize: number;
  customWidth: number;
  lineHeight: number;
  widthMode: 'a4' | 'adaptive' | 'custom';
}

const widthForMode = ({ customWidth, widthMode }: DocumentThemePreferences): string => {
  if (widthMode === 'a4') {
    return '794px';
  }
  return widthMode === 'custom' ? `${customWidth}px` : '100%';
};

const inlinePaddingForMode = ({ widthMode }: DocumentThemePreferences): string =>
  widthMode === 'adaptive' ? 'clamp(16px, 2vw, 24px)' : 'clamp(32px, 5vw, 48px)';

const bodyFontForFamily = (family: DocumentThemePreferences['bodyFamily']): string =>
  family === 'sans-serif'
    ? 'Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
    : '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", Georgia, serif';

export const getDocumentThemeVariables = (
  preferences: DocumentThemePreferences,
): Record<string, string> => ({
  '--document-body-font': bodyFontForFamily(preferences.bodyFamily),
  '--document-body-size': `${preferences.bodySize}px`,
  '--document-line-height': `${preferences.lineHeight}`,
  '--document-inline-padding': inlinePaddingForMode(preferences),
  '--document-width': widthForMode(preferences),
});

export const createDocumentThemeCss = (preferences: DocumentThemePreferences): string => {
  const variables = Object.entries(getDocumentThemeVariables(preferences))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${documentThemeCss}\n:root {\n${variables}\n}`;
};

export const documentThemeCss = `
:root {
  --document-background: #fcfdfd;
  --document-foreground: #202826;
  --document-heading: #18211f;
  --document-muted: #52605c;
  --document-border: #d8dfdd;
  --document-border-strong: #bac9c3;
  --document-primary: #25684f;
  --document-primary-hover: #174e3a;
  --document-selection: #c9dfd4;
  --document-selection-current: #f3d77d;
  --document-subtle: #f8faf9;
  --document-raised: #ffffff;
  --document-code: #f8faf9;
  --document-code-toolbar: #eef2f0;
  --document-table-heading: #f0f4f2;
  --document-inline-code: #f3f6f5;
  --document-error: #74372f;
  --document-error-border: #cbaea8;
  --document-error-background: #fbf7f6;
  --document-body-font: "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", Georgia, serif;
  --document-body-size: 17px;
  --document-line-height: 1.85;
  --document-inline-padding: clamp(16px, 2vw, 24px);
  --document-width: 100%;
  color: var(--document-foreground);
  background: var(--document-background);
  font-family: var(--document-body-font);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

:root[data-appearance="dark"] {
  --document-background: #171c1b;
  --document-foreground: #d9e0dd;
  --document-heading: #f1f4f3;
  --document-muted: #aab5b1;
  --document-border: #3a4541;
  --document-border-strong: #596762;
  --document-primary: #83bfa3;
  --document-primary-hover: #a2cfba;
  --document-selection: #365f4e;
  --document-selection-current: #776520;
  --document-subtle: #1b2220;
  --document-raised: #252c2a;
  --document-code: #1d2422;
  --document-code-toolbar: #252e2b;
  --document-table-heading: #252e2b;
  --document-inline-code: #252e2b;
  --document-error: #f0aaa0;
  --document-error-border: #8d5149;
  --document-error-background: #2b201f;
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

html,
body {
  min-height: 100%;
  margin: 0;
  background: var(--document-background);
}

body {
  overflow-wrap: anywhere;
}

.finished-document {
  width: min(100%, var(--document-width));
  min-width: 0;
  margin: 0 auto;
  padding: 72px var(--document-inline-padding) 120px;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  color: var(--document-heading);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  letter-spacing: 0;
  overflow-wrap: anywhere;
  scroll-margin-top: 28px;
}

::highlight(fuxian-find-results) {
  color: inherit;
  background: var(--document-selection);
}

::highlight(fuxian-find-current) {
  color: var(--document-foreground);
  background: var(--document-selection-current);
}

h1 {
  margin: 0 0 28px;
  font-size: 34px;
  line-height: 1.25;
  font-weight: 680;
}

h2 {
  margin: 48px 0 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--document-border);
  font-size: 25px;
  line-height: 1.35;
  font-weight: 660;
}

h3 {
  margin: 36px 0 16px;
  font-size: 21px;
  line-height: 1.45;
  font-weight: 650;
}

h4,
h5,
h6 {
  margin: 28px 0 12px;
  font-size: 17px;
  line-height: 1.55;
  font-weight: 650;
}

p,
li {
  font-size: var(--document-body-size);
  line-height: var(--document-line-height);
}

p {
  margin: 0 0 20px;
}

ul,
ol {
  margin: 0 0 24px;
  padding-left: 28px;
}

li + li {
  margin-top: 6px;
}

a {
  color: var(--document-primary);
  text-decoration-color: var(--document-border-strong);
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

a:hover {
  color: var(--document-primary-hover);
  text-decoration-color: currentColor;
}

blockquote {
  margin: 28px 0;
  padding: 2px 0 2px 22px;
  border-left: 3px solid var(--document-primary);
  color: var(--document-muted);
}

blockquote > :last-child {
  margin-bottom: 0;
}

hr {
  height: 1px;
  margin: 44px 0;
  border: 0;
  background: var(--document-border);
}

table {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 28px 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 14px;
  line-height: 1.55;
}

th,
td {
  min-width: 120px;
  padding: 10px 12px;
  border: 1px solid var(--document-border);
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

th {
  color: var(--document-heading);
  background: var(--document-table-heading);
  font-weight: 650;
}

tbody tr:nth-child(even) {
  background: var(--document-subtle);
}

.contains-task-list {
  padding-left: 4px;
  list-style: none;
}

.task-list-item input {
  width: 15px;
  height: 15px;
  margin: 0 9px 0 0;
  accent-color: var(--document-primary);
  vertical-align: -2px;
}

code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.88em;
  font-variant-ligatures: none;
}

:not(pre) > code {
  padding: 2px 5px;
  border: 1px solid var(--document-border);
  border-radius: 3px;
  color: var(--document-foreground);
  background: var(--document-inline-code);
  overflow-wrap: anywhere;
}

.code-block {
  max-width: 100%;
  margin: 28px 0;
  overflow: hidden;
  border: 1px solid var(--document-border);
  border-radius: 4px;
  background: var(--document-code);
}

.code-toolbar {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--document-border);
  color: var(--document-muted);
  background: var(--document-code-toolbar);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 12px;
}

.code-language {
  text-transform: lowercase;
}

.code-copy-button {
  width: 56px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--document-muted);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.code-copy-button:hover,
.code-copy-button:focus-visible {
  border-color: var(--document-border-strong);
  color: var(--document-primary);
  background: var(--document-raised);
  outline: none;
}

.code-block pre {
  max-width: 100%;
  margin: 0;
  padding: 18px 20px;
  overflow: auto;
  color: var(--document-foreground);
  background: var(--document-code);
  line-height: 1.65;
  tab-size: 2;
}

.code-block pre code {
  white-space: pre;
}

.render-task-source[hidden],
.render-task-output[hidden],
.render-task-error[hidden] {
  display: none !important;
}

.render-task-source {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.math-render-task-inline {
  display: inline;
}

.math-render-task-inline > .render-task-source {
  color: var(--document-muted);
}

.math-render-task-inline > .render-task-output {
  display: inline-block;
  max-width: 100%;
  vertical-align: -0.12em;
}

.math-render-task:not(.math-render-task-inline),
.diagram-render-task {
  position: relative;
  display: block;
  max-width: 100%;
  margin: 28px 0;
}

.diagram-action-toolbar {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  height: 22px;
  margin-bottom: 4px;
  gap: 4px;
  opacity: 0;
  transition: opacity 120ms ease-out;
}

.diagram-render-task:hover > .diagram-action-toolbar,
.diagram-render-task:focus-within > .diagram-action-toolbar {
  opacity: 1;
}

.diagram-action-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid var(--document-border);
  border-radius: 3px;
  color: var(--document-muted);
  background: var(--document-raised);
  cursor: pointer;
}

.diagram-action-button:hover,
.diagram-action-button:focus-visible {
  color: var(--document-heading);
  border-color: var(--document-primary);
  outline: none;
}

.diagram-action-button:focus-visible {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--document-primary) 28%, transparent);
}

.diagram-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.diagram-action-button svg {
  width: 13px;
  height: 13px;
}

.diagram-action-button::after {
  position: absolute;
  right: 0;
  bottom: calc(100% + 6px);
  display: none;
  width: max-content;
  max-width: 160px;
  padding: 5px 7px;
  border-radius: 3px;
  color: var(--document-raised);
  background: var(--document-heading);
  content: attr(data-tooltip);
  font-size: 12px;
  line-height: 1.2;
  pointer-events: none;
}

.diagram-action-button:hover::after,
.diagram-action-button:focus-visible::after {
  display: block;
}

.math-render-task:not(.math-render-task-inline) > .render-task-source,
.diagram-render-task > .render-task-source {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--document-border);
  border-radius: 3px;
  color: var(--document-muted);
  background: var(--document-code);
  font-size: 13px;
  line-height: 1.65;
}

.math-render-task:not(.math-render-task-inline) > .render-task-output,
.diagram-render-task > .render-task-output {
  width: 100%;
  overflow: auto;
  text-align: center;
}

.math-render-task math[display="block"] {
  margin: 0 auto;
  font-size: 1.12em;
}

.diagram-render-task svg {
  display: block;
  max-width: 100%;
  margin: 0 auto;
}

.diagram-render-task[data-render-task-kind="plantuml"] svg {
  width: auto;
  height: auto;
  max-height: calc(100vh - 96px);
  object-fit: contain;
}

.diagram-render-task svg text,
.diagram-render-task svg tspan {
  user-select: text;
}

.render-task[data-render-state="succeeded"] > .render-task-output {
  animation: render-task-fade-in 150ms ease-out;
}

@keyframes render-task-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.render-task-error {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px 14px;
  align-items: center;
  width: 100%;
  min-height: 92px;
  padding: 14px 16px;
  border: 1px solid var(--document-error-border);
  border-left: 3px solid var(--document-error);
  border-radius: 3px;
  color: var(--document-error);
  background: var(--document-error-background);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}

.render-task-error-title,
.render-task-error-detail,
.render-task-error-source {
  min-width: 0;
  overflow-wrap: anywhere;
}

.render-task-error-detail,
.render-task-error-source {
  grid-column: 1;
}

.render-task-retry-button {
  grid-row: 1 / span 3;
  grid-column: 2;
  width: 56px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--document-error-border);
  border-radius: 3px;
  color: var(--document-error);
  background: var(--document-raised);
  font: inherit;
  cursor: pointer;
}

.render-task-retry-button:hover,
.render-task-retry-button:focus-visible {
  border-color: var(--document-error);
  outline: none;
}

.math-render-task-inline > .render-task-error {
  display: inline-flex;
  width: auto;
  min-height: 0;
  margin: 0 3px;
  padding: 3px 5px;
  gap: 6px;
  vertical-align: baseline;
}

.math-render-task-inline .render-task-error-title,
.math-render-task-inline .render-task-error-detail {
  display: none;
}

.math-render-task-inline .render-task-retry-button {
  width: auto;
  height: 24px;
  padding: 0 6px;
}

@media (prefers-reduced-motion: reduce) {
  .render-task[data-render-state="succeeded"] > .render-task-output {
    animation: none;
  }
}

@media (forced-colors: active) {
  .code-copy-button:focus-visible,
  .diagram-action-button:focus-visible,
  .resource-retry-button:focus-visible,
  .render-task-retry-button:focus-visible {
    border-color: Highlight;
    outline: 2px solid Highlight;
    outline-offset: 2px;
    box-shadow: none;
  }

  .diagram-action-toolbar {
    forced-color-adjust: auto;
  }

  .render-task-error {
    border-color: Mark;
    color: MarkText;
    background: Canvas;
  }

  .diagram-action-button:disabled {
    border-color: GrayText;
    color: GrayText;
  }
}

.hljs-comment,
.hljs-quote {
  color: #73807b;
  font-style: italic;
}

.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-built_in {
  color: #9a3f36;
}

.hljs-string,
.hljs-attr,
.hljs-template-variable {
  color: #236348;
}

.hljs-title,
.hljs-section,
.hljs-function .hljs-title {
  color: #315e82;
}

.hljs-number,
.hljs-symbol,
.hljs-variable {
  color: #76538c;
}

:root[data-appearance="dark"] .hljs-comment,
:root[data-appearance="dark"] .hljs-quote {
  color: #96a39e;
}

:root[data-appearance="dark"] .hljs-keyword,
:root[data-appearance="dark"] .hljs-selector-tag,
:root[data-appearance="dark"] .hljs-literal,
:root[data-appearance="dark"] .hljs-built_in {
  color: #e58f82;
}

:root[data-appearance="dark"] .hljs-string,
:root[data-appearance="dark"] .hljs-attr,
:root[data-appearance="dark"] .hljs-template-variable {
  color: #8bc9a9;
}

:root[data-appearance="dark"] .hljs-title,
:root[data-appearance="dark"] .hljs-section,
:root[data-appearance="dark"] .hljs-function .hljs-title {
  color: #8eb9dc;
}

:root[data-appearance="dark"] .hljs-number,
:root[data-appearance="dark"] .hljs-symbol,
:root[data-appearance="dark"] .hljs-variable {
  color: #c0a0d2;
}

details {
  margin: 24px 0;
  padding: 12px 16px;
  border: 1px solid var(--document-border);
  border-radius: 4px;
  background: var(--document-subtle);
}

summary {
  color: var(--document-foreground);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-weight: 650;
  cursor: pointer;
}

.footnotes {
  margin-top: 56px;
  padding-top: 24px;
  border-top: 1px solid var(--document-border);
  color: var(--document-muted);
}

.footnotes h2 {
  margin-top: 0;
  font-size: 18px;
}

.footnotes p,
.footnotes li {
  font-size: 14px;
  line-height: 1.7;
}

img,
svg {
  max-width: 100%;
  height: auto;
}

.document-image {
  display: block;
  max-width: 100%;
  margin: 32px 0;
}

.document-image > img {
  display: block;
  max-width: 100%;
  margin: 0 auto;
  border-radius: 3px;
}

.document-image > img[hidden] {
  display: none;
}

.resource-error {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 6px 16px;
  align-items: center;
  width: 100%;
  min-height: 92px;
  padding: 16px 18px;
  border: 1px solid var(--document-error-border);
  border-left: 3px solid var(--document-error);
  border-radius: 3px;
  color: var(--document-error);
  background: var(--document-error-background);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: 13px;
  line-height: 1.55;
  text-align: left;
}

.resource-error[hidden] {
  display: none;
}

.resource-error-title,
.resource-error-detail,
.resource-error-source {
  min-width: 0;
  overflow-wrap: anywhere;
}

.resource-error-title {
  color: var(--document-error);
  font-size: 14px;
}

.resource-error-detail {
  grid-column: 1;
}

.resource-error-source {
  grid-column: 1;
  justify-self: start;
}

.resource-retry-button {
  grid-row: 1 / span 3;
  grid-column: 2;
  width: 56px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--document-error-border);
  border-radius: 3px;
  color: var(--document-error);
  background: var(--document-raised);
  font: inherit;
  cursor: pointer;
}

.resource-retry-button:hover,
.resource-retry-button:focus-visible {
  border-color: var(--document-error);
  outline: none;
}

::selection {
  color: var(--document-heading);
  background: var(--document-selection);
}

@media (max-width: 700px) {
  .finished-document {
    padding: 48px 20px 88px;
  }
}

@media print {
  .finished-document {
    width: 100%;
    padding: 0;
  }

  .code-toolbar {
    display: none;
  }

  .resource-retry-button {
    display: none;
  }

  .diagram-render-task[data-render-task-kind="plantuml"] svg {
    max-height: none;
  }

  .render-task-retry-button {
    display: none;
  }

  .code-block pre code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}
`;
