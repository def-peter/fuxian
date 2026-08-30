export interface DocumentThemePreferences {
  appearance: 'dark' | 'light';
  bodyFamily: 'sans-serif' | 'serif';
  bodySize: number;
  codeTheme: 'fuxian-dark' | 'fuxian-light' | 'github-dark' | 'github-light';
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
  --document-link: #3f4b55;
  --document-link-hover: #25292d;
  --document-selection: #c9dfd4;
  --document-selection-current: #f3d77d;
  --document-subtle: #f8faf9;
  --document-raised: #ffffff;
  --document-table-heading: #f0f4f2;
  --document-inline-code: #f3f6f5;
  --document-error: #74372f;
  --document-error-border: #cbaea8;
  --document-error-background: #fbf7f6;
  --document-scrollbar-thumb-idle: color-mix(in srgb, var(--document-muted) 12%, transparent);
  --document-scrollbar-thumb-active: color-mix(in srgb, var(--document-muted) 42%, transparent);
  --document-body-font: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  --document-body-size: 15px;
  --document-line-height: 1.85;
  --document-inline-padding: clamp(16px, 2vw, 24px);
  --document-width: 100%;
  --code-background: #f7faf8;
  --code-toolbar: #edf2ef;
  --code-foreground: #27312e;
  --code-muted: #66746f;
  --code-border: #d4ddda;
  --code-hover: #e3ebe7;
  --code-accent: #25684f;
  --syntax-comment: #71807a;
  --syntax-keyword: #9a3f36;
  --syntax-string: #236348;
  --syntax-title: #315e82;
  --syntax-number: #76538c;
  --syntax-variable: #8a5a2b;
  --syntax-meta: #5a647c;
  --syntax-deletion: #b4473f;
  --syntax-addition: #27734f;
  color: var(--document-foreground);
  background: var(--document-background);
  font-family: var(--document-body-font);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

@supports not selector(::-webkit-scrollbar-thumb) {
  :root {
    scrollbar-color: var(--document-scrollbar-thumb-idle) transparent;
  }

  :root[data-scroll-active="true"] {
    scrollbar-color: var(--document-scrollbar-thumb-active) transparent;
  }
}

::-webkit-scrollbar,
::-webkit-scrollbar-track,
::-webkit-scrollbar-track-piece,
::-webkit-scrollbar-corner {
  border: 0;
  background: transparent;
}

::-webkit-scrollbar-thumb {
  border: 4px solid transparent;
  border-radius: 999px;
  background-color: var(--document-scrollbar-thumb-idle);
  background-clip: padding-box;
  transition: background-color 120ms ease-out;
}

:root[data-scroll-active="true"]::-webkit-scrollbar-thumb,
::-webkit-scrollbar-thumb:hover {
  background-color: var(--document-scrollbar-thumb-active);
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
  --document-link: #c4cbd0;
  --document-link-hover: #f1f4f3;
  --document-selection: #365f4e;
  --document-selection-current: #776520;
  --document-subtle: #1b2220;
  --document-raised: #252c2a;
  --document-table-heading: #252e2b;
  --document-inline-code: #252e2b;
  --document-error: #f0aaa0;
  --document-error-border: #8d5149;
  --document-error-background: #2b201f;
  color-scheme: dark;
}

:root[data-code-theme="fuxian-dark"] {
  --code-background: #181e1c;
  --code-toolbar: #222a27;
  --code-foreground: #d8dfdc;
  --code-muted: #96a39e;
  --code-border: #35413d;
  --code-hover: #2c3632;
  --code-accent: #a2cfba;
  --syntax-comment: #96a39e;
  --syntax-keyword: #e58f82;
  --syntax-string: #8bc9a9;
  --syntax-title: #8eb9dc;
  --syntax-number: #c0a0d2;
  --syntax-variable: #e0b77a;
  --syntax-meta: #aab3d3;
  --syntax-deletion: #ff9b90;
  --syntax-addition: #78c99b;
}

:root[data-code-theme="github-light"] {
  --code-background: #ffffff;
  --code-toolbar: #f6f8fa;
  --code-foreground: #24292f;
  --code-muted: #57606a;
  --code-border: #d0d7de;
  --code-hover: #eef1f4;
  --code-accent: #0969da;
  --syntax-comment: #6e7781;
  --syntax-keyword: #cf222e;
  --syntax-string: #0a3069;
  --syntax-title: #8250df;
  --syntax-number: #0550ae;
  --syntax-variable: #953800;
  --syntax-meta: #0550ae;
  --syntax-deletion: #82071e;
  --syntax-addition: #116329;
}

:root[data-code-theme="github-dark"] {
  --code-background: #0d1117;
  --code-toolbar: #161b22;
  --code-foreground: #c9d1d9;
  --code-muted: #8b949e;
  --code-border: #30363d;
  --code-hover: #21262d;
  --code-accent: #58a6ff;
  --syntax-comment: #8b949e;
  --syntax-keyword: #ff7b72;
  --syntax-string: #a5d6ff;
  --syntax-title: #d2a8ff;
  --syntax-number: #79c0ff;
  --syntax-variable: #ffa657;
  --syntax-meta: #79c0ff;
  --syntax-deletion: #ffa198;
  --syntax-addition: #7ee787;
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
  color: var(--document-link);
  text-decoration-color: var(--document-border-strong);
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

a:hover,
a:focus-visible {
  color: var(--document-link-hover);
  text-decoration-color: currentColor;
}

a:focus-visible {
  border-radius: 2px;
  outline: 2px solid color-mix(in srgb, var(--document-link) 55%, transparent);
  outline-offset: 2px;
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

blockquote.callout {
  --callout-accent: #496674;
  --callout-border: #c8d5da;
  --callout-background: #f5f8f9;
  --callout-symbol: "i";
  margin: 28px 0;
  padding: 14px 18px 16px 16px;
  border: 1px solid var(--callout-border);
  border-left: 3px solid var(--callout-accent);
  border-radius: 4px;
  color: var(--document-foreground);
  background: var(--callout-background);
  box-decoration-break: clone;
}

.callout[data-callout-family="guidance"] {
  --callout-accent: #326b61;
  --callout-border: #bfd4ce;
  --callout-background: #f3f8f6;
  --callout-symbol: "↗";
}

.callout[data-callout-family="important"] {
  --callout-accent: #3f5f86;
  --callout-border: #c2cfdd;
  --callout-background: #f4f7fa;
  --callout-symbol: "!";
}

.callout[data-callout-family="positive"] {
  --callout-accent: #35664c;
  --callout-border: #c2d4c8;
  --callout-background: #f4f8f5;
  --callout-symbol: "✓";
}

.callout[data-callout-family="risk"] {
  --callout-accent: #8a5b18;
  --callout-border: #dcccae;
  --callout-background: #fbf8f1;
  --callout-symbol: "!";
}

.callout[data-callout-family="danger"] {
  --callout-accent: #8a453e;
  --callout-border: #ddc1bd;
  --callout-background: #fbf5f4;
  --callout-symbol: "×";
}

.callout[data-callout-family="quote"] {
  --callout-accent: #67645e;
  --callout-border: #d0cdc6;
  --callout-background: #f8f7f5;
  --callout-symbol: "“";
}

:root[data-appearance="dark"] .callout {
  --callout-accent: #94b4c2;
  --callout-border: #42545b;
  --callout-background: #1b2326;
}

:root[data-appearance="dark"] .callout[data-callout-family="guidance"] {
  --callout-accent: #8cc1b4;
  --callout-border: #3e5b54;
  --callout-background: #1a2421;
}

:root[data-appearance="dark"] .callout[data-callout-family="important"] {
  --callout-accent: #9eb8d7;
  --callout-border: #43566c;
  --callout-background: #1c222a;
}

:root[data-appearance="dark"] .callout[data-callout-family="positive"] {
  --callout-accent: #8fc4a3;
  --callout-border: #405d4c;
  --callout-background: #1a241e;
}

:root[data-appearance="dark"] .callout[data-callout-family="risk"] {
  --callout-accent: #d5b06d;
  --callout-border: #655536;
  --callout-background: #282318;
}

:root[data-appearance="dark"] .callout[data-callout-family="danger"] {
  --callout-accent: #e0a09a;
  --callout-border: #694742;
  --callout-background: #291e1d;
}

:root[data-appearance="dark"] .callout[data-callout-family="quote"] {
  --callout-accent: #bcb7ad;
  --callout-border: #55514a;
  --callout-background: #22211e;
}

.callout-header {
  display: flex;
  gap: 9px;
  align-items: center;
  min-height: 20px;
  margin: 0 0 8px;
  color: var(--callout-accent);
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-size: calc(var(--document-body-size) * 0.94);
  font-weight: 680;
  line-height: 1.45;
}

.callout-header::before {
  display: grid;
  width: 17px;
  height: 17px;
  flex: 0 0 17px;
  place-items: center;
  border: 1px solid color-mix(in srgb, currentColor 58%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, currentColor 8%, transparent);
  content: var(--callout-symbol);
  font-size: 11px;
  font-weight: 760;
  line-height: 1;
}

.callout[data-callout-family="quote"] .callout-header::before {
  border-color: transparent;
  background: transparent;
  font-family: Georgia, serif;
  font-size: 20px;
  line-height: 0.8;
}

.callout > p,
.callout > ul,
.callout > ol,
.callout > .code-block,
.callout > blockquote {
  margin-bottom: 14px;
}

.callout > .callout-header + p {
  margin-top: 0;
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
  border: 1px solid var(--code-border);
  border-radius: 4px;
  background: var(--code-background);
}

.code-toolbar {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--code-border);
  color: var(--code-muted);
  background: var(--code-toolbar);
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
  color: var(--code-muted);
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.code-copy-button:hover,
.code-copy-button:focus-visible {
  border-color: var(--code-border);
  color: var(--code-accent);
  background: var(--code-hover);
  outline: none;
}

.code-block pre {
  max-width: 100%;
  margin: 0;
  padding: 18px 20px;
  overflow: auto;
  color: var(--code-foreground);
  background: var(--code-background);
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
  outline: 2px solid transparent;
  outline-offset: 5px;
  scroll-margin-block: 32px;
  transition: outline-color 120ms ease-out;
}

.diagram-render-task:focus {
  outline-color: color-mix(in srgb, var(--document-primary) 55%, transparent);
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

.diagram-render-task[data-render-task-kind="infographic"] foreignObject span {
  user-select: text;
}

.render-task[data-render-state="succeeded"] > .render-task-output {
  animation: render-task-fade-in 150ms ease-out;
}

:root[data-pdf-export] .render-task[data-render-state="succeeded"] > .render-task-output {
  animation: none;
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
  ::-webkit-scrollbar-thumb {
    transition: none;
  }

  .render-task[data-render-state="succeeded"] > .render-task-output {
    animation: none;
  }
}

@media (forced-colors: active) {
  :root {
    scrollbar-color: auto;
  }

  ::-webkit-scrollbar-track,
  ::-webkit-scrollbar-corner,
  ::-webkit-scrollbar-thumb {
    forced-color-adjust: auto;
  }

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

  blockquote.callout {
    border-color: CanvasText;
    color: CanvasText;
    background: Canvas;
    forced-color-adjust: auto;
  }

  .diagram-action-button:disabled {
    border-color: GrayText;
    color: GrayText;
  }
}

.hljs-comment,
.hljs-quote {
  color: var(--syntax-comment);
  font-style: italic;
}

.hljs-doctag,
.hljs-formula,
.hljs-keyword,
.hljs-selector-tag,
.hljs-literal,
.hljs-template-tag,
.hljs-type {
  color: var(--syntax-keyword);
}

.hljs-attr,
.hljs-attribute,
.hljs-number,
.hljs-operator,
.hljs-selector-attr {
  color: var(--syntax-number);
}

.hljs-name,
.hljs-section,
.hljs-selector-class,
.hljs-selector-id,
.hljs-title,
.hljs-title.class_,
.hljs-title.function_ {
  color: var(--syntax-title);
}

.hljs-regexp,
.hljs-string {
  color: var(--syntax-string);
}

.hljs-built_in,
.hljs-bullet,
.hljs-link,
.hljs-symbol,
.hljs-variable.language_ {
  color: var(--syntax-variable);
}

.hljs-params,
.hljs-template-variable,
.hljs-variable {
  color: var(--syntax-variable);
}

.hljs-meta,
.hljs-meta .hljs-keyword,
.hljs-meta .hljs-string {
  color: var(--syntax-meta);
}

.hljs-deletion {
  color: var(--syntax-deletion);
}

.hljs-addition {
  color: var(--syntax-addition);
}

.hljs-emphasis {
  font-style: italic;
}

.hljs-strong {
  font-weight: 700;
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
  :root {
    scrollbar-color: auto;
  }

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

  blockquote.callout {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  .code-block pre code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}
`;
