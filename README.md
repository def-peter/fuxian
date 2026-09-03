<p align="center">
  <img src="design/logo/final/app-icon/fuxian-app-icon-128.png" alt="浮现 Fuxian 应用图标" width="112" height="112" />
</p>

<h1 align="center">浮现 (Fuxian)</h1>

<p align="center"><strong>让内容精彩浮现，让 Markdown 值得阅读。</strong></p>

<p align="center">
  面向 Windows 和 macOS，专注阅读体验的 Markdown 桌面应用。<br />
  让来自 AI 或其他工具的 Markdown 更易读，也方便演示、分享和导出 PDF。
</p>

<p align="center">
  <a href="https://github.com/def-peter/fuxian/releases/latest"><img src="https://img.shields.io/github/v/release/def-peter/fuxian?style=flat-square" alt="最新版本" /></a>
  <a href="https://github.com/def-peter/fuxian/releases"><img src="https://img.shields.io/github/downloads/def-peter/fuxian/total?style=flat-square" alt="下载量" /></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-2f6feb?style=flat-square" alt="支持 Windows 和 macOS" />
  <a href="https://github.com/def-peter/fuxian/actions/workflows/release-installers.yml"><img src="https://img.shields.io/github/actions/workflow/status/def-peter/fuxian/release-installers.yml?style=flat-square&amp;label=release" alt="发布工作流" /></a>
  <a href="https://github.com/def-peter/fuxian/stargazers"><img src="https://img.shields.io/github/stars/def-peter/fuxian?style=flat-square" alt="GitHub Stars" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/def-peter/fuxian?style=flat-square" alt="MIT 许可证" /></a>
</p>

## ✨ 核心亮点

- 📖 **阅读优先**：文字、表格、代码、公式与本地图片以完整文档呈现；多文档会话保留阅读位置，并平稳接收外部修订。
- 📊 **四类可视化**：原生支持 [Mermaid](https://mermaid.js.org/)、[PlantUML](https://plantuml.com/)、[Vega-Lite](https://vega.github.io/vega-lite/) 与 [AntV Infographic](https://infographic.antv.vision/)，可查看源码、复制 SVG 和全屏浏览。
- 📄 **可靠 PDF**：A4 纸张预览与 PDF 使用同一套打印布局，导出会等待公式、图片和异步图表就绪。
- ✏️ **轻量源码编辑**：阅读与编辑模式互斥，显式保存后回到清晰完整的阅读视图，不加入实时分栏预览。

浮现始终以阅读体验为核心。它不是知识库、完整 IDE 或所见即所得编辑器。

## 📥 下载

前往 [GitHub Releases](https://github.com/def-peter/fuxian/releases/latest) 下载 Windows x64、macOS Apple Silicon 或 macOS Intel 版本。

> [!IMPORTANT]
> 当前安装包尚未签名。Windows 可能显示未知发布者或 SmartScreen 提示；macOS 可能需要在**系统设置 > 隐私与安全性**中手动允许打开。Linux 目前仅作为开发和 CI 平台。

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
