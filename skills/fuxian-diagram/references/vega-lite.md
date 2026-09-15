# Vega-Lite

统计图先确定观测单位、指标与数据口径，再选择 mark、encoding 和变换。全部示例数据为演示用途。

## 按需读取

编写任何 Vega-Lite 图前，读取 [配色规则](vega-lite/layout-troubleshooting.md#默认配色)。选定图类型后读取对应指南并据其完整示例改写；遇到渲染或版面问题再读排错部分。无需一次加载全部分支。

| 当前任务                               | 指南                                                             | 内容                                     |
| -------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| 类别比较、排名、计划与实际             | [comparison.md](vega-lite/comparison.md)                         | 条形、并排柱形、排序与零基线             |
| 时间趋势、多系列、累计量               | [trends.md](vega-lite/trends.md)                                 | 折线、面积、日期与累计变换               |
| 分布形状、分箱、组间离散程度           | [distribution.md](vega-lite/distribution.md)                     | 直方图与箱线图，样本与统计口径           |
| 两个变量的共同变化、二维强度           | [correlation-heatmap.md](vega-lite/correlation-heatmap.md)       | 散点与热力图，连续/发散色标              |
| 组成、批次内占比、少量类别摘要         | [composition.md](vega-lite/composition.md)                       | 百分比堆叠与环形图                       |
| 派生指标、宽表转长表、标注叠加、分面   | [transforms-facets.md](vega-lite/transforms-facets.md)           | aggregate/calculate/fold、layer 与 facet |
| 空白图、异常比率、错位、尺寸和资源错误 | [layout-troubleshooting.md](vega-lite/layout-troubleshooting.md) | 逐层诊断与版面修正                       |

## 共通约束

- 输出合法 JSON 与 `vega-lite` 围栏；完整 Vega 不是 Fuxian 接受的围栏，不能靠改名转换。
- 字段大小写、类型、单位和日期口径保持一致；缺失不自动当作零，聚合要可回溯。
- 数据内联，可用命名 datasets；Fuxian 的 schema/compiler 与静态快照边界见 [capabilities.md](capabilities.md)。
- 报告关键数值在初始快照就应可读，hover/交互只能作为额外辅助。
- 示例 schema 为当前 Vega-Lite v6，较早目标版本应先核对能力。
