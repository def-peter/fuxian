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
}

h1 {
  margin: 0 0 28px;
  font-size: 34px;
  line-height: 1.25;
  font-weight: 680;
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

::selection {
  color: #17231f;
  background: #c9dfd4;
}

@media (max-width: 700px) {
  .finished-document {
    padding: 48px 32px 88px;
  }
}
`;
