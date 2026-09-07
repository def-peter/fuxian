<p align="center">
  <img src="design/logo/final/app-icon/fuxian-app-icon-128.png" alt="浮现 Fuxian 应用图标" width="112" height="112" />
</p>

<p align="center">
  简体中文 · <a href="README.md">English</a>
</p>

<h1 align="center">浮现 (Fuxian)</h1>

<p align="center"><strong>让内容精彩浮现，让 Markdown 值得阅读。</strong></p>

<p align="center">
  面向 Windows 和 macOS，专注阅读体验的 Markdown 桌面应用。<br />
  让来自 AI 或其他工具的 Markdown 更易读，也方便演示、分享和导出 PDF。
</p>

<p align="center">
  <a href="https://github.com/def-peter/fuxian/releases/latest"><img src="https://img.shields.io/github/v/release/def-peter/fuxian?style=flat-square" alt="最新版本" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-2f6feb?style=flat-square" alt="支持 Windows 和 macOS" />
  <a href="LICENSE"><img src="https://img.shields.io/github/license/def-peter/fuxian?style=flat-square" alt="MIT 许可证" /></a>
</p>

## ✨ 核心功能

- 📖 **打开就能读**：直接打开 `.md` 或 `.markdown` 文件，标题、表格、代码、公式和本地图片都会排版显示。
- 📊 **图表直接显示**：[Mermaid](https://mermaid.js.org/)、[PlantUML](https://plantuml.com/)、[Vega-Lite](https://vega.github.io/vega-lite/) 和 [AntV Infographic](https://infographic.antv.vision/) 代码块会显示为图表，还能全屏查看、复制源码或 SVG。
- 📄 **导出 PDF**：支持 A4 纸张预览，可以在导出前检查分页和版式。
- ✏️ **小改动不用换应用**：进入源码编辑模式即可修改、查找和替换文字，保存后继续阅读。

浮现始终以阅读体验为核心。它不是知识库、完整 IDE 或所见即所得编辑器。

> **文档的终点，不是写完，而是让人看懂。**

## 🖼️ 实际效果

源码安静地留在背后，真正值得阅读的内容浮现在眼前。

### 一篇 Markdown，也可以读得像一篇好文章

标题、段落、引用、表格、清单和提示块被整理进安静、连贯的阅读版面，大纲始终在手边。

![浮现中的 Markdown 阅读界面](docs/assets/readme/zh/01-finished-document.png)

继续向下，任务清单、公式、代码、折叠内容和脚注仍然属于同一篇文章，不需要在工具之间来回切换。

![浮现中的公式、代码、折叠内容与脚注](docs/assets/readme/zh/02-rich-markdown.png)

### 从目录快速看懂结构

除了沿着右侧大纲跳转，还可以把整篇文章的标题关系展开成一张大纲图。

![浮现的文章大纲图](docs/assets/readme/zh/03-article-outline-map.png)

### 四种图表，四种表达方式

Mermaid、PlantUML、Vega-Lite 和 AntV Infographic 都会直接成为文档的一部分。每种框架都能表达丰富的结构，下面只是四个贴近工作的场景示例。需要核对时，可以随时查看源码；阅读和导出时，看到的始终是清晰的 SVG 图形。

**Mermaid 示例：用思维导图梳理一场客户到访。**

![浮现渲染 Mermaid 思维导图并查看源码](docs/assets/readme/zh/04-mermaid.png)

**PlantUML 示例：用顺序图追踪一次代码发布。**

![浮现渲染 PlantUML 顺序图并查看源码](docs/assets/readme/zh/05-plantuml.png)

**Vega-Lite 示例：用六张图组成一页经营看板。**

![浮现渲染 Vega-Lite 数据看板并查看源码](docs/assets/readme/zh/06-vega-lite.png)

**AntV Infographic 示例：用信息图拆解新品首发的转化路径。**

![浮现渲染 AntV Infographic 并查看源码](docs/assets/readme/zh/07-antv-infographic.png)

## 📥 下载

前往 [GitHub Releases](https://github.com/def-peter/fuxian/releases/latest) 下载 Windows x64、macOS Apple Silicon 或 macOS Intel 版本。

> [!IMPORTANT]
> 当前安装包尚未签名。Windows 可能显示未知发布者或 SmartScreen 提示；macOS 可能需要在**系统设置 > 隐私与安全性**中手动允许打开。

## 🛠️ 开发

需要 Node.js 22.12 或更高版本，以及由 Corepack 管理的 pnpm 11.18。

```bash
pnpm install
pnpm dev
```

提交前运行：

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

发布流程见 [`docs/release.md`](docs/release.md)，配套图表创作 Skill 见 [`skill/fuxian-diagram-authoring`](skill/fuxian-diagram-authoring/SKILL.md)。

## 💬 反馈

欢迎通过 [GitHub Issues](https://github.com/def-peter/fuxian/issues) 提交问题和功能建议。

## 📄 许可证

由 Peter Li 创作。浮现使用 [MIT 许可证](LICENSE)发布。
