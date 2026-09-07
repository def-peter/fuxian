<p align="center">
  <img src="design/logo/final/app-icon/fuxian-app-icon-128.png" alt="Fuxian app icon" width="112" height="112" />
</p>

<p align="center">
  <a href="README.md">简体中文</a> · English
</p>

<h1 align="center">Fuxian</h1>

<p align="center"><strong>Bring content to life. Make Markdown worth reading.</strong></p>

<p align="center">
  A Markdown desktop reader for Windows and macOS, built for reading rather than wrestling with source.<br />
  Turn Markdown from AI and other tools into something polished, readable, and ready to present, share, or export as PDF.
</p>

<p align="center">
  <a href="https://github.com/def-peter/fuxian/releases/latest"><img src="https://img.shields.io/github/v/release/def-peter/fuxian?style=flat-square" alt="Latest release" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-2f6feb?style=flat-square" alt="Windows and macOS" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/def-peter/fuxian?style=flat-square" alt="MIT license" /></a>
</p>

## ✨ Core features

- 📖 **Open and read:** Open any `.md` or `.markdown` file directly. Headings, tables, code, math, and local images are laid out for comfortable reading.
- 📊 **Visuals rendered in place:** Code blocks written for [Mermaid](https://mermaid.js.org/), [PlantUML](https://plantuml.com/), [Vega-Lite](https://vega.github.io/vega-lite/), and [AntV Infographic](https://infographic.antv.vision/) become polished visuals. Open them full screen, inspect the source, or copy the SVG.
- 📄 **PDF delivery:** Preview real A4 pages before export, so pagination and layout never have to be a surprise.
- ✏️ **Light editing when you need it:** Make a quick change, find and replace text, save, and return to reading without switching apps.

Fuxian keeps reading at the center. It is not a knowledge base, a full IDE, or a WYSIWYG editor.

> **A document does not end with the final word. It ends when the reader understands.**

## 🖼️ See it in action

The source stays in the background. The content comes forward.

### Markdown that reads like a real article

Headings, prose, quotes, tables, lists, and callouts settle into one calm, continuous reading surface, with the outline always close at hand.

![A Markdown document open in Fuxian](docs/assets/readme/en/01-finished-document.png)

Further down the page, task lists, math, code, collapsible sections, and footnotes still feel like part of the same article. There is no need to jump between tools.

![Math, code, collapsible content, and footnotes in Fuxian](docs/assets/readme/en/02-rich-markdown.png)

### See the shape of an article at a glance

Use the outline to move between sections, or open the article outline map to see how the whole document fits together.

![The article outline map in Fuxian](docs/assets/readme/en/03-article-outline-map.png)

### Four visual languages, each at home in the document

Mermaid, PlantUML, Vega-Lite, and AntV Infographic all render right inside the document. Each framework can express a wide range of structures; the four examples below are simply a few ways they can fit into real work. The source is one click away when you need to check it; for reading and PDF export, the result stays crisp, selectable SVG.

**Mermaid example: a mind map for preparing a client visit.**

![A Mermaid mind map with its source open in Fuxian](docs/assets/readme/en/04-mermaid.png)

**PlantUML example: a sequence diagram that follows code into production.**

![A PlantUML sequence diagram with its source open in Fuxian](docs/assets/readme/en/05-plantuml.png)

**Vega-Lite example: six charts combined into a monthly business dashboard.**

![A Vega-Lite business dashboard with its source open in Fuxian](docs/assets/readme/en/06-vega-lite.png)

**AntV Infographic example: a visual story of how launch traffic becomes orders.**

![An AntV Infographic with its source open in Fuxian](docs/assets/readme/en/07-antv-infographic.png)

## 📥 Download

Visit [GitHub Releases](https://github.com/def-peter/fuxian/releases/latest) for Windows x64, macOS Apple Silicon, and macOS Intel builds.

> [!IMPORTANT]
> Current builds are unsigned. Windows may show an unknown publisher or SmartScreen warning. On macOS, you may need to allow the app manually under **System Settings > Privacy & Security**.

## 🛠️ Development

You will need Node.js 22.12 or later and pnpm 11.18 managed through Corepack.

```bash
pnpm install
pnpm dev
```

Before submitting a change, run:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

See [`docs/release.md`](docs/release.md) for the release process and [`skill/fuxian-diagram-authoring`](skill/fuxian-diagram-authoring/SKILL.md) for the companion visual-authoring skill.

## 💬 Feedback

Use [GitHub Issues](https://github.com/def-peter/fuxian/issues) for bug reports and feature requests.

## 📄 License

Created by Peter Li. Fuxian is released under the [MIT License](LICENSE).
