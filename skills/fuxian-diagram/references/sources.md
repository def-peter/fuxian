# 参考来源与取舍

2026-09-15 阅读以下上游 SKILL.md 后，按 Fuxian 当前能力重新编写。它们提供创作方法，不定义 Fuxian 的支持边界；按需回查，普通作图不必全部加载。

| 来源                                                                                                                             | 保留的思路                                                   | Fuxian 中的调整                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| [design-doc-mermaid](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/SKILL.md)                                | 意图路由、按需加载图类型指南、从真实代码推导结构、渲染后修正 | 重叠场景改为 PlantUML 优先；不强制 Emoji、固定配色、图片副本、外部服务链或完整设计文档模板 |
| [Markdown Viewer UML](https://github.com/markdown-viewer/skills/blob/main/uml/SKILL.md)                                          | UML 图类型、元素、关系语义、注释与分组                       | 默认 mars；去除宣传与 `mxgraph.*` 专属扩展，专用图类型保留正确的起止标记                   |
| [Markdown Viewer Vega](https://github.com/markdown-viewer/skills/blob/main/vega/SKILL.md)                                        | 数据到 mark/encoding 的映射、JSON、字段和类型检查            | 只输出 Fuxian 支持的 Vega-Lite；schema 跟随版本；不把完整 Vega、交互应用当作成品能力       |
| [AntV infographic-creator](https://github.com/antvis/chart-visualization-skills/blob/master/skills/infographic-creator/SKILL.md) | 信息结构先行、模板匹配、DSL 数据字段与语言一致性             | 查实际模板而非猜字段；直接交付 Markdown 围栏，不强制创建 CDN HTML、不反问用户选择模板      |

对上游示例中的字段冲突、过期规则或环境扩展，以目标运行时、官方文档和真实渲染结果裁定。未来维护时同步复核 `capabilities.md` 与示例。

## 本地细分指南的取材范围

- Mermaid：进一步阅读上游的 [活动](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/references/guides/diagrams/activity-diagrams.md)、[时序](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/references/guides/diagrams/sequence-diagrams.md)、[架构](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/references/guides/diagrams/architecture-diagrams.md)、[部署](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/references/guides/diagrams/deployment-diagrams.md)、[源码映射](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/references/guides/code-to-diagram/README.md)和[排错](https://github.com/spillwavesolutions/design-doc-mermaid/blob/main/references/guides/troubleshooting.md)中的相关章节。保留分支、异步、层次和取证方法，示例按独立小场景重新编写。
- PlantUML：阅读上游 [uml/examples](https://github.com/markdown-viewer/skills/tree/main/uml/examples) 中的活动、泳道、时序、状态、类、组件、部署、用例、对象和包图；按标准 PlantUML 与 mars 主题重写。Mindmap/WBS 等补充类型核对官方语法与真实渲染。
- Vega-Lite：阅读上游 [examples.md](https://github.com/markdown-viewer/skills/blob/main/vega/references/examples.md) 的比较、趋势、分布、分面、分层与变换模式；补充零分母、加权口径、日期和静态快照说明，使用独立示例数据。
- Infographic：依据上游模板分类展开列表、序列、比较、层级、关系和数字摘要；模板名与自定义 design 另由 Fuxian 当前依赖的注册表/解析器及渲染结果核实。

文档按使用条件组织，不追求上游文件数量。保留不同图类型中真正改变创作决策的知识，把已验证示例与成品检查结合，避免仅列语法名或链接后让模型自行猜测。
