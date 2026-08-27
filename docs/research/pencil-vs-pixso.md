# Pencil 与 Pixso：面向 Fuxian 的 AI 设计工作流评估

## 结论

若首要标准是**让我准确理解原型，再按现有 Electron + React + TypeScript 架构实现**，推荐使用 **Pencil（现名 pen.dev）**。若首要标准是**直接生成一版 React 代码**，Pixso 的专用 `design_to_code` 链路更强。

Fuxian 更需要长期讨论状态、布局和交互，而不是一次性还原静态页面。因此建议：**Pencil 作为原型和设计结构来源，仓库文档作为行为规格，React 代码由项目内手工实现。** 不建议把任一工具生成的代码直接视为生产实现。

## 产品身份

这里的 Pencil 是 [pen.dev](https://www.pen.dev/)（`pencil.dev` 当前重定向到该域名），不是使用 `.epz` 的 [Evolus Pencil Project](https://github.com/evolus/pencil)。当前 Codex 接入操作的是 `.pen` 文件和 pen.dev MCP。

## 核心比较

| 维度       | Pencil / pen.dev                                                                                                      | Pixso                                                                                       | 对 Fuxian 的判断                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 结构可读性 | `.pen` 是带 TypeScript schema 的对象树，节点使用 `frame/text/icon/ref`、变量和类 Flex 布局；MCP 的 `Get` 可按深度读取 | Compact DSL 同样含布局、文字、组件和引用，但完整语义需递归解析组件、变量、样式与资源        | **Pencil 更直接、噪声更少**                     |
| 组件与变量 | `reusable + ref + descendants` 明确表达实例与覆盖；变量使用 `$token`                                                  | 组件集、变体、共享样式、变量及远程库能力更完整，且有独立查询工具                            | 小团队原型 Pencil 足够；成熟设计系统 Pixso 更强 |
| 视觉校验   | `TakeScreenshot`；遍历节点还能返回 bounds 与 clipped 问题                                                             | `take_screenshot` + `check_layout`，并有独立属性/字体检查能力                               | **Pixso 略强**                                  |
| React 衔接 | 官方流程要求读取节点和组件，再由 AI 映射至现有框架；画布导出以 HTML/CSS、HTML/Tailwind 为主                           | 专用 `design_to_code` 支持 React、Vue、HTML、Flutter、ArkUI，并规定资源本地化和生成代码清理 | **Pixso 的直接起稿更强**                        |
| 迭代编辑   | 一个 `execute` API 同时提供查询、批量 JS 生成、组件复用、截图与导出，修改链路短                                       | 专用工具更丰富，但需在 `apply_design`、DSL、组件/样式/变量和截图工具间切换                  | **Pencil 更容易稳定迭代**                       |
| 可移植性   | 官方文档称 `.pen` 为 JSON、适合 Git；但当前 MCP 明确提示本地 `.pen` 已加密、只能通过 MCP 访问                         | Desktop MCP 不提供原始 Kiwi/完整文件快照；设计通常留在 Pixso 文件/云端                      | 两者都不应替代仓库内规格文档                    |

## 当前项目实测

- Pencil 当前文件一次 `Get(..., { depth: 3 })` 即可读出 3 套方案、3 个可复用组件、变量引用、实例覆盖和语义化层名；页面结构可以直接映射为 React 区域与组件。
- Pixso 当前主界面 `3:1` 的 compact DSL 为 `30,657` bytes、超过 100 个节点；图标包含较多底层矢量节点。本稿还显示 `variableMap: 0`、`localStyleMap: 0`，因此已有画布没有发挥 Pixso 的设计系统优势。
- 这是**当前生成物的对比**，不是对两款工具所有项目的普遍性能结论。视觉质量主要取决于设计约束、内容和迭代，而不是文件格式本身。

## 决策建议

采用 Pencil 继续完成完整评审组，并设置三个交付门槛：

1. 所有顶层区域和复用组件使用稳定、语义化名称。
2. 颜色、字体、间距进入变量；重复控件必须使用 `ref`，避免仅靠视觉相似。
3. 每个关键状态同时交付截图、节点树和对应行为说明；代码实现以仓库规格为准。

仅当后续明确需要设计师在成熟设计系统中协作，或希望用专用 D2C 快速生成 React 起稿时，再迁回 Pixso。

## 一手资料

- pen.dev：[The .pen Format](https://docs.pen.dev/for-developers/the-pen-format)、[Components](https://docs.pen.dev/core-concepts/components)、[AI Integration](https://docs.pen.dev/getting-started/ai-integration)、[Design to Code](https://docs.pen.dev/design-and-code/design-to-code)、[CLI](https://docs.pen.dev/for-developers/pen-cli)
- Pixso：[MCP 工具](https://pixso.cn/developer/zh/mcp/tools.html)、[D2C 快速开始](https://pixso.cn/developer/zh/d2c/quick-start.html)、[组件解析器](https://pixso.cn/developer/zh/d2c/component-parsers.html)
- 当前环境官方插件说明：[Pixso design-to-code](/Users/peter/.codex/plugins/cache/pixso/pixso/1.0.11/skills/pixso-design-to-code/SKILL.md)、[Pixso compact DSL](/Users/peter/.codex/plugins/cache/pixso/pixso/1.0.11/skills/pixso-read-dsl/references/compact-dsl.md)
