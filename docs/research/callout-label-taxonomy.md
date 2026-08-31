# Markdown Callout 标签体系调研

> 调研日期：2026-08-30。本文只采用各产品的官方文档与官方源码；重点比较作者在 Markdown 源码中写下的标签，不把产品界面的颜色、图标或组件名称误当作 Markdown 标签。

## 结论

Fuxian 已确定使用 Markdown 引用块扩展语法：

```markdown
> [!NOTE]
> 这是一段补充说明。
```

与这套源码语法直接兼容、又有明确官方定义的体系主要是 **GitHub Alerts** 和 **Obsidian Callouts**：

- GitHub 定义 5 个类型：`NOTE`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION`。
- Obsidian 定义 13 个内置类型和 14 个别名；类型名不区分大小写，未知类型在没有自定义样式时使用 `note` 外观。
- Notion 的 Callout 是一个可设置图标和颜色的块对象，没有 `[!TYPE]` 标签枚举，因此只适合作为视觉设计参考，不能作为源码标签规范。
- MkDocs Material、Docusaurus 和 MyST 使用 `!!!` 或 `:::` directive，不与 `[!TYPE]` 直接兼容；它们的类型名可用于判断哪些语义常见，但不应直接扩大 Fuxian 的首版语法范围。

建议首版接受 Obsidian 的全部 27 个常见拼写，但在语义层把 GitHub 的 `important` 和 `caution` 保留为独立类型，而不是照搬 Obsidian 的别名视觉。这样既能读取大量已有 Obsidian 文档，也不会丢失 GitHub 作者明确表达的语义。

## 一手资料核对

### GitHub Alerts

GitHub 官方把 Alerts 描述为基于 blockquote 的 Markdown 扩展，并明确只提供 5 种类型：

| 源码标签    | GitHub 官方语义                    |
| ----------- | ---------------------------------- |
| `NOTE`      | 浏览内容时也应知道的有用信息       |
| `TIP`       | 更好或更容易完成事情的建议         |
| `IMPORTANT` | 实现目标所需的关键信息             |
| `WARNING`   | 为避免问题而需要立即注意的紧急信息 |
| `CAUTION`   | 某些行为可能带来的风险或负面结果   |

GitHub 还建议只在确实影响用户成功时使用，每篇文章限制为一到两个，避免连续放置，并说明 Alerts 不能嵌套在其他元素中。这里的 5 个名字是 GitHub 的**源码标签集合**，不是 5 个任意配色名称。

来源：[GitHub Docs: Basic writing and formatting syntax - Alerts](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)（访问日期：2026-08-30）。

### Obsidian Callouts

Obsidian 官方文档把 `[!info]` 中的 `info` 定义为 type identifier，并明确说明类型标识符不区分大小写。内置类型与别名如下：

| Obsidian 内置类型 | 官方别名               |
| ----------------- | ---------------------- |
| `note`            | 无                     |
| `abstract`        | `summary`、`tldr`      |
| `info`            | 无                     |
| `todo`            | 无                     |
| `tip`             | `hint`、`important`    |
| `success`         | `check`、`done`        |
| `question`        | `help`、`faq`          |
| `warning`         | `caution`、`attention` |
| `failure`         | `fail`、`missing`      |
| `danger`          | `error`                |
| `bug`             | 无                     |
| `example`         | 无                     |
| `quote`           | `cite`                 |

这形成 13 个内置类型、14 个别名，共 27 个可见于现有文档的常用源码拼写。

Obsidian 对未知类型有清晰的兼容策略：除非 CSS snippet 或社区插件定义了该类型，否则使用 `note` 类型的外观。自定义类型通过 `.callout[data-callout="custom-question-type"]` 定义颜色与 Lucide/SVG 图标；因此“任意自定义 identifier 可以存在”与“内置类型只有 13 个”是两个不同事实。

来源：[Obsidian Help: Callouts](https://help.obsidian.md/callouts)、[Obsidian Help 官方源码](https://github.com/obsidianmd/obsidian-help/blob/master/en/Editing%20and%20formatting/Callouts.md)（访问日期：2026-08-30）。

### Notion Callout

Notion API 把 Callout 定义为 `type: "callout"` 的块对象。`callout` 属性包含：

- `rich_text`：内容；
- `icon`：emoji、自定义 emoji、Notion 原生 icon 或 file；
- `color`：固定颜色枚举及对应的 background 变体。

官方数据模型没有 `note`、`warning`、`tip` 等语义标签字段。也就是说，Notion Callout 的差异来自作者选择的图标和颜色，而不是一个固定的语义类型体系。Fuxian 可以参考它“克制背景色 + 明确图标”的视觉处理，但不能声称兼容“Notion 标签”。

来源：[Notion API: Block object - Callout](https://developers.notion.com/reference/block#callout)（访问日期：2026-08-30）。

## 其他官方体系对照

这些体系不使用 Fuxian 已选定的 `[!TYPE]` blockquote 语法，仅用于验证语义名称是否常见。

| 体系                | 官方/稳定类型                                                                                                       | 语法与补充事实                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Docusaurus          | `note`、`tip`、`info`、`warning`、`danger`                                                                          | 使用 `:::type`。官方主题源码另保留未文档化的 legacy aliases：`secondary`、`important`、`success`、`caution`，不宜作为新的稳定规范。 |
| Material for MkDocs | `note`、`abstract`、`info`、`tip`、`success`、`question`、`warning`、`failure`、`danger`、`bug`、`example`、`quote` | 使用 `!!! type`。未知 qualifier 回退为 `note`；旧的额外 qualifier 已弃用，并计划在下一主版本移除。                                  |
| MyST                | `note`、`important`、`hint`、`seealso`、`tip`、`attention`、`caution`、`warning`、`danger`、`error`                 | 使用 `:::{type}`。官方说明这 10 种来自 Docutils/Sphinx，并允许插件增加其他类型。                                                    |

来源：

- [Docusaurus: Admonitions](https://docusaurus.io/docs/markdown-features/admonitions)、[Docusaurus 官方主题类型源码](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-theme-classic/src/theme/Admonition/Types.tsx)（访问日期：2026-08-30）。
- [Material for MkDocs: Admonitions](https://squidfunk.github.io/mkdocs-material/reference/admonitions/)、[Material for MkDocs 官方样式源码](https://github.com/squidfunk/mkdocs-material/blob/master/src/templates/assets/stylesheets/main/extensions/markdown/_admonition.scss)（访问日期：2026-08-30）。
- [MyST: Callouts & Admonitions](https://mystmd.org/guide/admonitions)、[MyST 官方 directive 源码](https://github.com/jupyter-book/mystmd/blob/main/packages/myst-directives/src/admonition.ts)（访问日期：2026-08-30）。

## 常见程度矩阵

下表中的“支持”只说明该名字在该体系中具有官方语义；Docusaurus、MkDocs Material 与 MyST 的源码语法仍然不同。

| 标签        | GitHub |    Obsidian    | MkDocs Material |     Docusaurus     | MyST |
| ----------- | :----: | :------------: | :-------------: | :----------------: | :--: |
| `note`      |  内置  |      内置      |      内置       |        内置        | 内置 |
| `tip`       |  内置  |      内置      |      内置       |        内置        | 内置 |
| `important` |  内置  |   `tip` 别名   |        -        | legacy `info` 别名 | 内置 |
| `warning`   |  内置  |      内置      |      内置       |        内置        | 内置 |
| `caution`   |  内置  | `warning` 别名 |        -        |    legacy 类型     | 内置 |
| `info`      |   -    |      内置      |      内置       |        内置        |  -   |
| `danger`    |   -    |      内置      |      内置       |        内置        | 内置 |
| `success`   |   -    |      内置      |      内置       | legacy `tip` 别名  |  -   |
| `error`     |   -    | `danger` 别名  |        -        |         -          | 内置 |
| `abstract`  |   -    |      内置      |      内置       |         -          |  -   |
| `question`  |   -    |      内置      |      内置       |         -          |  -   |
| `failure`   |   -    |      内置      |      内置       |         -          |  -   |
| `bug`       |   -    |      内置      |      内置       |         -          |  -   |
| `example`   |   -    |      内置      |      内置       |         -          |  -   |
| `quote`     |   -    |      内置      |      内置       |         -          |  -   |
| `todo`      |   -    |      内置      |        -        |         -          |  -   |
| `hint`      |   -    |   `tip` 别名   |        -        |         -          | 内置 |
| `attention` |   -    | `warning` 别名 |        -        |         -          | 内置 |
| `seealso`   |   -    |       -        |        -        |         -          | 内置 |

## Fuxian 首版建议

### 1. 源码标签集合

首版接受以下 27 个大小写不敏感的源码 identifier，以覆盖 GitHub Alerts 和 Obsidian Callouts 的全部常用拼写：

```text
note abstract summary tldr info todo tip hint important
success check done question help faq warning caution attention
failure fail missing danger error bug example quote cite
```

不要把 27 个拼写直接实现成 27 套 CSS。解析层先保留作者写下的 identifier，再显式映射到语义类型。

### 2. 语义规范化

| 作者源码                      | Fuxian 建议语义类型 | 说明                                  |
| ----------------------------- | ------------------- | ------------------------------------- |
| `note`                        | `note`              | 中性备注                              |
| `abstract`、`summary`、`tldr` | `abstract`          | 摘要                                  |
| `info`                        | `info`              | 信息说明                              |
| `todo`                        | `todo`              | 待办事项                              |
| `tip`、`hint`                 | `tip`               | 建议或技巧                            |
| `important`                   | `important`         | 保留 GitHub 的独立“关键信息”语义      |
| `success`、`check`、`done`    | `success`           | 成功、完成或正向结果                  |
| `question`、`help`、`faq`     | `question`          | 问题、帮助或常见问题                  |
| `warning`、`attention`        | `warning`           | 警告或需要立即关注的信息              |
| `caution`                     | `caution`           | 保留 GitHub 的独立“风险/负面结果”语义 |
| `failure`、`fail`、`missing`  | `failure`           | 失败或缺失                            |
| `danger`、`error`             | `danger`            | 严重错误或危险                        |
| `bug`                         | `bug`               | 缺陷                                  |
| `example`                     | `example`           | 示例                                  |
| `quote`、`cite`               | `quote`             | 引用或引文                            |

这会得到 15 个语义类型。`important` 与 `caution` 的处理是有意选择：Obsidian 会分别映射到 `tip` 与 `warning`，但 GitHub 把二者定义成独立含义；Fuxian 面向通用 Markdown 成品阅读，保留作者语义比复刻单个平台配色更稳妥。

### 3. 视觉分类不是标签集合

15 个语义类型无需使用 15 种完全不同的颜色。可以先收敛成较少的视觉家族，再通过标题、Lucide 图标和强调程度区分同一家族中的类型：

| 视觉家族  | 可包含的语义类型                              |
| --------- | --------------------------------------------- |
| 中性/说明 | `note`、`abstract`、`info`、`todo`、`example` |
| 建议/求助 | `tip`、`question`                             |
| 关键强调  | `important`                                   |
| 正向结果  | `success`                                     |
| 风险提醒  | `warning`、`caution`                          |
| 失败/危险 | `failure`、`danger`、`bug`                    |
| 引用      | `quote`                                       |

这是视觉 token 分组，不应反向改变解析后的语义类型。样式应比普通 blockquote 更明确但仍保持成品文档的克制感；不能只靠颜色表达类型，PDF 和灰阶打印时也应能通过图标、标题和边线层级识别。

### 4. 未知与自定义标签

建议对任何结构合法但未内置的 `[!custom-name]`：

1. 仍识别为 callout，不降级成普通引用块；
2. 保留原 identifier 作为默认标题；
3. 使用 `note` 的视觉 token；
4. 首版不承诺加载 Obsidian CSS snippets、社区插件或任意作者 CSS。

这与 Obsidian 的未知类型回退行为一致，也能无损阅读带自定义 callout 的源文档。自定义样式能力是另一项产品决策，不应与“能否识别 callout 内容”绑定。

## 不建议纳入首版的扩展

- 不因为 MyST 支持就立即加入 `seealso`；它不是 GitHub/Obsidian `[!TYPE]` 的常用标签，可在真实 fixture 出现后再补。
- 不采用 Docusaurus 未文档化的 `secondary` legacy alias。
- 不把 Notion 的 emoji 或颜色名当作标签。
- 折叠标记、嵌套、自定义标题和自定义 CSS 都是独立能力，不能从“支持更多标签”自动推导为首版范围。
