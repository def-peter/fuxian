# Fuxian Website Concept

`homepage-concept-v1.png` is an early composition study generated with Codex's built-in image generation tool. It is not used as a website asset; the implemented site uses HTML, CSS, and genuine Fuxian screenshots.

## Prompt

```text
Use case: ui-mockup
Asset type: high-fidelity desktop landing-page visual direction for the Fuxian product website
Primary request: Design a polished single-page Chinese website concept for 浮现, a Windows and macOS desktop reader that turns Markdown into finished documents for reading and PDF export. Use the supplied Fuxian logo and genuine application screenshots as strict product references. The first viewport must make the product and the actual app interface immediately recognizable.
Scene/backdrop: cool white editorial canvas with subtle paper texture and fine gray rules; no decorative gradient background
Style/medium: premium modern technical-publication website, restrained, credible, calm, crafted for readers and knowledge workers
Composition/framing: 16:9 desktop website screenshot. Compact top navigation with the logo and 浮现. Hero headline on the left reading exactly “让 Markdown，值得阅读。” with concise supporting copy and one dark primary download button. A large, sharply legible application window presentation dominates the right and lower hero area. A hint of the next section is visible at the bottom with three concise capability labels. Use an asymmetric editorial grid, generous whitespace, and small precise typography.
Color palette: cool white, graphite black, neutral gray, and restrained cobalt blue from the logo; a small amount of muted coral may appear only in product content
Text (verbatim): “浮现”, “让 Markdown，值得阅读。”, “免费下载”, “Windows 与 macOS”, “沉浸阅读”, “图形原生呈现”, “导出精美 PDF”
Constraints: preserve the supplied logo design; show the real product interface accurately; crisp readable Chinese; professional realistic web design; 4-8px corner radii; no browser chrome around the whole composition
Avoid: dark navy theme, purple gradients, beige or tan palette, glassmorphism, floating orb decorations, oversized slogan, stacked card grid, fake dashboard metrics, stock photography, generic SaaS style, illegible placeholder text, watermark
```

## Feature guide screenshots

`capture-features.mjs` captures the current Electron app in isolated, hidden test windows. Run it after building the desktop app:

```sh
corepack pnpm --filter @fuxian/desktop build
node design/website/capture-features.mjs
```

The bilingual `apps/website/public/examples/reading-guide-*.md` documents supply the reading, 16-heading article outline, source-editing, and three-page paper screenshots. The paper view is scrolled to show a page boundary while keeping the real toolbar and page count visible. The Mermaid result is captured from the exact `reading-flow-*.md` download, using the app's renderer. Generated PNGs go to `apps/website/public/images/feature-*.png` and `example-flow-*.png`.

Four-language screenshots in the feature gallery reuse the localized homepage assets. That gallery changes only on user input. The homepage carousels keep their existing timing.
