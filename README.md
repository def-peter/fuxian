<p align="center">
  <img src="design/logo/final/app-icon/fuxian-app-icon-128.png" alt="浮现 Fuxian" width="128" height="128" />
</p>

<h1 align="center">浮现 (Fuxian)</h1>

<p align="center"><strong>让技术图表真正浮现在 Markdown 中。</strong></p>

<p align="center">
  面向 Windows 和 macOS 的 Markdown 成品文档工具。<br />
  在一份文档中统一呈现 Mermaid、PlantUML、Vega-Lite 与 AntV Infographic，<br />
  将代码、公式、图表和信息图交付为适合阅读、演示与 PDF 输出的成品。
</p>

<p align="center">
  <a href="https://github.com/def-peter/fuxian/releases/latest"><strong>下载最新版本</strong></a>
  ·
  <a href="https://github.com/def-peter/fuxian/issues">查看路线图</a>
</p>

> Fuxian is a reading-first Markdown desktop app for Windows and macOS. It renders Mermaid, PlantUML, Vega-Lite, and AntV Infographic as selectable SVG content in polished documents with reliable PDF delivery.

## 技术可视化

浮现不只把图表代码替换成一张图片。四类可视化内容共享成品文档中的阅读体验：可以选择图中文字、查看和复制源码、复制 SVG，并在全屏画布中浏览。导出 PDF 时，浮现会等待异步图表就绪，并复用经过清理的 SVG 结果。

| 框架             | Markdown 代码块     | 适合表达                     | 渲染方式                         |
| ---------------- | ------------------- | ---------------------------- | -------------------------------- |
| Mermaid          | `mermaid`           | 流程、时序、状态与关系       | 应用内本地渲染                   |
| PlantUML         | `plantuml` / `puml` | 软件架构、UML 与复杂图示     | 通过可配置的 PlantUML 服务渲染   |
| Vega-Lite        | `vega-lite`         | 基于数据的统计图表           | 在隔离 Worker 中本地渲染         |
| AntV Infographic | `infographic`       | 叙事型信息图与结构化视觉表达 | 使用官方模板在隔离 Worker 中渲染 |

为了保证本地文档的安全性和 PDF 结果的稳定性，Vega-Lite 当前仅接受经过校验的 JSON 与内联数据；AntV Infographic 当前支持经过审核的官方静态模板。PlantUML 默认使用公共服务，也可以在设置中改为本地或私有服务；其源码会发送到所配置的服务。

## 阅读与交付

- 将 Markdown 呈现为排版完整的成品文档，而不是始终停留在源码与预览之间。
- 支持 KaTeX 公式、GitHub/Obsidian Callout、表格、代码高亮和本地图片。
- 提供连续阅读与 A4 纸张预览，使用同一套打印布局导出 PDF。
- 从当前文档大纲生成可折叠、缩放的文章结构图。
- 在一个可恢复的文档会话中打开多份独立文档，并保留阅读位置。
- 跟踪其他程序写入的外部修订，在不中断阅读位置的前提下更新成品文档。

## 产品方向：轻编辑，重阅读

当前发布版本专注于只读的成品文档阅读与交付。轻量 Markdown 源码编辑已经列入[产品路线图](https://github.com/def-peter/fuxian/issues/40)：阅读模式只看成品，编辑模式只看源码，保存后回到最新渲染结果。

```text
阅读模式（只看成品） ⇄ 编辑模式（只看源码）
```

这项能力用于临时修改和补充内容，不会把浮现变成所见即所得编辑器、实时分栏预览、知识库或完整 IDE。

## 下载

前往 [GitHub Releases](https://github.com/def-peter/fuxian/releases/latest) 下载最新版本：

- Windows x64
- macOS Intel
- macOS Apple Silicon

当前 Windows 和 macOS 安装包尚未签名。Windows 可能显示未知发布者或 SmartScreen 提示，macOS 可能需要手动允许打开。Linux 目前仅作为开发和 CI 平台。

## 本地开发

环境要求：Node.js 22.12 或更高版本，以及由 Corepack 管理的 pnpm 11.18。

```bash
pnpm install
pnpm dev
```

常用检查命令：

```bash
pnpm build
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
```

发布打包流程见 [`docs/release.md`](docs/release.md)。

## 项目结构

- `apps/desktop`：Electron 主进程、preload 和 React renderer
- `packages/markdown-renderer`：独立于 React 和 Electron 的 Markdown 渲染管线
- `packages/document-theme`：成品文档样式
- `packages/render-protocol`：异步渲染就绪协议
- `packages/shared-types`：跨进程与跨包类型

## License

Fuxian is available under the [MIT License](LICENSE).
