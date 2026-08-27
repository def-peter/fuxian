export const documentThemeCss = `
:root {
  color: #202826;
  background: #fcfdfd;
  font-family: "Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", Georgia, serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
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
  background: #fcfdfd;
}

body {
  overflow-wrap: anywhere;
}

.finished-document {
  width: min(100%, 860px);
  min-width: 0;
  margin: 0 auto;
  padding: 72px 72px 120px;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  color: #18211f;
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  letter-spacing: 0;
  overflow-wrap: anywhere;
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
  border-bottom: 1px solid #dde3e1;
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
  font-size: 17px;
  line-height: 1.85;
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
  color: #25684f;
  text-decoration-color: #8cb5a4;
  text-underline-offset: 3px;
  overflow-wrap: anywhere;
}

a:hover {
  color: #174e3a;
  text-decoration-color: currentColor;
}

blockquote {
  margin: 28px 0;
  padding: 2px 0 2px 22px;
  border-left: 3px solid #7fa997;
  color: #52605c;
}

blockquote > :last-child {
  margin-bottom: 0;
}

hr {
  height: 1px;
  margin: 44px 0;
  border: 0;
  background: #d9e0de;
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
  border: 1px solid #d8dfdd;
  text-align: left;
  vertical-align: top;
  overflow-wrap: anywhere;
}

th {
  color: #26322f;
  background: #f0f4f2;
  font-weight: 650;
}

tbody tr:nth-child(even) {
  background: #f8faf9;
}

.contains-task-list {
  padding-left: 4px;
  list-style: none;
}

.task-list-item input {
  width: 15px;
  height: 15px;
  margin: 0 9px 0 0;
  accent-color: #2f7258;
  vertical-align: -2px;
}

code {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.88em;
  font-variant-ligatures: none;
}

:not(pre) > code {
  padding: 2px 5px;
  border: 1px solid #dce3e0;
  border-radius: 3px;
  color: #34433e;
  background: #f3f6f5;
  overflow-wrap: anywhere;
}

.code-block {
  max-width: 100%;
  margin: 28px 0;
  overflow: hidden;
  border: 1px solid #d5ddda;
  border-radius: 4px;
  background: #f6f8f7;
}

.code-toolbar {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid #dce3e0;
  color: #65716d;
  background: #eef2f0;
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
  color: #40504a;
  background: transparent;
  font: inherit;
  cursor: pointer;
}

.code-copy-button:hover,
.code-copy-button:focus-visible {
  border-color: #bac9c3;
  color: #1f5d46;
  background: #ffffff;
  outline: none;
}

.code-block pre {
  max-width: 100%;
  margin: 0;
  padding: 18px 20px;
  overflow: auto;
  color: #293632;
  background: #f8faf9;
  line-height: 1.65;
  tab-size: 2;
}

.code-block pre code {
  white-space: pre;
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

details {
  margin: 24px 0;
  padding: 12px 16px;
  border: 1px solid #d8dfdd;
  border-radius: 4px;
  background: #f8faf9;
}

summary {
  color: #34423e;
  font-family: Inter, "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  font-weight: 650;
  cursor: pointer;
}

.footnotes {
  margin-top: 56px;
  padding-top: 24px;
  border-top: 1px solid #d9e0de;
  color: #52605c;
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

::selection {
  color: #17231f;
  background: #c9dfd4;
}

@media (max-width: 700px) {
  .finished-document {
    padding: 48px 32px 88px;
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

  .code-block pre code {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
}
`;
