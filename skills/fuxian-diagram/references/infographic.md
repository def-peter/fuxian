# AntV Infographic

把叙事材料整理为清楚的信息结构，再选官方模板。不是先找漂亮模板，再把内容塞进去。

## 按需读取

选定图类型后，读取对应指南并据其完整示例改写；遇到渲染或版面问题再读排错指南。无需一次加载全部分支。

| 当前任务                                    | 指南                                                         | 内容                                    |
| ------------------------------------------- | ------------------------------------------------------------ | --------------------------------------- |
| 并列要点、步骤、时间线、里程碑              | [list-sequence.md](infographic/list-sequence.md)             | 列表与序列；短文案、时间字段与版面      |
| 两方案、SWOT、四象限分类                    | [comparison.md](infographic/comparison.md)                   | 三个完整示例，根项与比较维度            |
| 概念层级、组织树、关系网络                  | [hierarchy-relations.md](infographic/hierarchy-relations.md) | 单一 root、children、nodes 与 relations |
| 同口径数值摘要、关键词权重                  | [charts.md](infographic/charts.md)                           | 数字图与词云，特定模板字段              |
| 自定义主题/design、动画、卡片换行、资源问题 | [theme-layout.md](infographic/theme-layout.md)               | 完整 design 示例与故障定位              |
| 需要选择模板、核实精确名称或寻找变体        | [template-catalog.md](infographic/template-catalog.md)       | 按信息结构整理的已核实候选模板          |

## 共通约束

- 官方 DSL 使用缩进与 `key value`，不是 JSON 或带冒号的 YAML。
- 字段按实际模板映射；`lists`、`sequences`、`compares`、`root` 等有各自语义，不用通用 items 猜测。
- 普通模板第一行写 `infographic <精确名称>`；自定义 design 的完整写法见对应指南。
- Fuxian 支持官方主题、design 与动画能力；输出 `infographic` 围栏即可，资源和快照边界见 [capabilities.md](capabilities.md)。
- 模板存在、源码通过解析和全部内容正确显示，是三个不同的验证点。
