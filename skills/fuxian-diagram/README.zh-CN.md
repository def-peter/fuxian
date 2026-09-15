# Fuxian Diagram

[English](README.md) · 简体中文

不必先了解图形引擎，也能把复杂内容变成易读图示。这是 [浮现 Fuxian](https://github.com/def-peter/fuxian) 的配套图形创作 Skill：先找出需要解释的重点，再选择合适的图形，生成 Markdown 图形源码并校验排版。

**[了解浮现](https://github.com/def-peter/fuxian) · [下载阅读器](https://github.com/def-peter/fuxian/releases/latest) · [反馈问题](https://github.com/def-peter/fuxian/issues)**

## 安装

准备好 Node.js 和 npm，运行：

```bash
npx skills add def-peter/fuxian --skill fuxian-diagram
```

根据提示选择使用的 AI 工具和安装范围。[skills CLI](https://github.com/vercel-labs/skills) 支持 Claude Code、Codex、Cursor 等工具；实际渲染能力取决于你的运行环境。

安装前查看仓库中的 Skill：

```bash
npx skills add def-peter/fuxian --list
```

更新已安装的 Skill：

```bash
npx skills update
```

Skill 提供创作指令和参考资料。阅读生成的 Markdown、导出 PDF 时，可另行安装浮现。其他阅读器可能只支持其中一部分图形格式。

## 能做什么

| 你的内容                                 | 通常选择                                |
| ---------------------------------------- | --------------------------------------- |
| 流程、角色交互、状态变化、系统架构       | PlantUML，默认使用 `mars` 主题          |
| 明确要求 Mermaid，或目标平台需要 Mermaid | Mermaid                                 |
| 数值比较、趋势、分布、相关性             | Vega-Lite，默认优先使用 Ant Design 配色 |
| 重点、阶段、里程碑、内容概览             | AntV Infographic                        |

你指定的图类型、引擎、主题和配色优先。PlantUML 与 Mermaid 都适合时，优先 PlantUML。Vega-Lite 默认以蓝、青、紫、绿、洋红为主；棕褐色用于有实际含义或用户明确指定的场景。

为整篇文档配图时，先锚定关键内容和难点，保留来源事实，交付可编辑源码。有渲染工具时校验语法与版式；无法验证渲染时明确说明。

## 试着这样说

- “给这份设计文档配图，选出最难理解的部分，把图放在对应内容旁边。”
- “解释这个审批流程，保留驳回和重新提交的分支，帮我选择合适的图形。”
- “根据这份月度营收 CSV 展示趋势和地区差异，优先使用 Ant Design 配色。”

也可以明确告诉 AI：使用 `fuxian-diagram`。

## 在浮现中阅读

浮现是面向 Windows 和 macOS 的 Markdown 桌面阅读器，可在同一篇文档中渲染这四类图形，并导出 PDF。以下截图展示阅读器的渲染能力，不代表 Skill 每次都会生成相同内容与样式。

![浮现中的 PlantUML 源码与图形](https://raw.githubusercontent.com/def-peter/fuxian/main/docs/assets/readme/zh/05-plantuml.png)

![浮现中的 Vega-Lite 数据看板](https://raw.githubusercontent.com/def-peter/fuxian/main/docs/assets/readme/zh/06-vega-lite.png)

## 文档

- [Skill 执行指令](SKILL.md)
- [图形选择指南](references/selection-guide.md)
- [浮现能力与渲染边界](references/capabilities.md)
- 引擎参考：[PlantUML](references/plantuml.md)、[Mermaid](references/mermaid.md)、[Vega-Lite](references/vega-lite.md)、[Infographic](references/infographic.md)
- [参考来源与致谢](references/sources.md)

项目链接用于说明来源和提供阅读器下载入口；Skill 不要求 AI 在生成的图示或回答中插入宣传链接。

## 许可证

由 Peter Li 创作，使用 [MIT 许可证](LICENSE)。上游参考来源见上述致谢文档。
