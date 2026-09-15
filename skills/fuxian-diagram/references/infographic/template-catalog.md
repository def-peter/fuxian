# 模板选型目录

这是按任务整理的候选集合，便于精确选型，不是全部官方模板的镜像。名称在 Fuxian 当前 `@antv/infographic` 0.2.20 注册表中核实；升级后以目标运行时为准。

| 用户内容       | 候选模板                                              | 选择条件                                       |
| -------------- | ----------------------------------------------------- | ---------------------------------------------- |
| 少量简短要点   | `list-row-simple-horizontal-arrow`                    | 横向短流程或要点串联                           |
| 带图标的要点   | `list-row-horizontal-icon-arrow`                      | 图标能帮助辨认角色/类别                        |
| 多个并列重点   | `list-grid-badge-card`                                | 网格卡片，避免横排过宽                         |
| 简洁清单       | `list-column-done-list`                               | 纵向列举，适合窄栏                             |
| 多项步骤说明   | `list-column-simple-vertical-arrow`                   | 纵向箭头，短标题与解释                         |
| 少量里程碑     | `sequence-timeline-simple`                            | 日期/阶段为核心                                |
| 较长路线图     | `sequence-roadmap-vertical-plain-text`                | 纵向展示阶段及描述                             |
| 循环关系       | `sequence-circular-simple`                            | 内容真正回到起点                               |
| 筛选与递减     | `sequence-funnel-simple`                              | 阶段筛选语义明确                               |
| 层级递进       | `sequence-pyramid-simple`                             | 确有层级或递进含义                             |
| 两方案         | `compare-hierarchy-left-right-circle-node-plain-text` | 显示两根项名称，子项按一致维度比较             |
| SWOT           | `compare-swot`                                        | 内部优势/劣势与外部机会/威胁；窄栏考虑四格模板 |
| 四象限分类     | `compare-quadrant-quarter-simple-card`                | 类别摘要，不是准确数据坐标                     |
| 普通层级树     | `hierarchy-tree-curved-line-rounded-rect-node`        | 单一 root 与 children                          |
| 向右展开的层级 | `hierarchy-tree-lr-curved-line-rounded-rect-node`     | 确认横向版面足够                               |
| 概念导图       | `hierarchy-mindmap-branch-gradient-capsule-item`      | 概念层级、同级分类一致                         |
| 静态关系       | `relation-dagre-flow-tb-badge-card`                   | nodes 与带标签 relations                       |
| 动态关系       | `relation-dagre-flow-tb-animated-simple-circle-node`  | 屏幕演示，静态帧仍完整                         |
| 少量同口径数值 | `chart-column-simple`                                 | 数字摘要，values                               |
| 关键词摘要     | `chart-wordcloud`                                     | 词权重已给定，按专用字段使用                   |

## 如何确认模板与字段

可访问 Fuxian 源码环境时，从桌面包的依赖解析 `@antv/infographic`，调用 `getTemplates()` 查名称，`getTemplate(name)` 查 structure/item 组成，使用 `parseSyntax()` 检查具体数据。模板存在只证明名字正确，不能证明所填字段会显示。

随后实际渲染并核对**每一项预期文本、数值与层级**。字段映射根据本目录关联的指南和目标模板定义决定：通用前缀只是线索，`hierarchy-structure`、交互关系类和词云等需要专用检查。

在无仓库依赖的环境使用 [官方文档](https://infographic.antv.vision/) 对应版本；不要要求用户先了解或选择模板。

## 已验证的模板差异

`sequence-timeline-simple` 的日期要放入可见标签；`chart-wordcloud` 默认不画标题，图题放在相邻 Markdown。部分二元 fold 模板不显示根项名称，并使用固定 PROS/CONS 装饰；命名方案对比优先本目录的 compare-hierarchy 模板。层级树默认可能没有 title 设计且节点较宽，可按层级指南显式配置。
