# 要点、步骤与里程碑

并列观点用 list；有明确顺序、日期或阶段推进用 sequence。先统一每项表达粒度，再选择横排、纵排或网格。

## 并列要点（示例）

```infographic
infographic list-grid-badge-card
data
  title 报告交付重点
  lists
    - label 内容
      desc 事实有据
      icon lucide/file-text
    - label 结构
      desc 层次清晰
      icon lucide/list-tree
    - label 图示
      desc 突出重点
      icon lucide/chart-bar
    - label 校验
      desc 成品可读
      icon lucide/check
```

列表的条目应能平行阅读。标签是类别，desc 是具体解释；不要四项分别写成部门、动作、时间和结论。

## 时间线（示例）

```infographic
infographic sequence-timeline-simple
data
  title 项目交付里程碑
  desc 日期为示例
  sequences
    - label 09-01 明确范围
      desc 确认阅读目标
    - label 09-05 完成初稿
      desc 整理事实依据
    - label 09-10 完成交付
      desc 检查成品排版
```

当前 `sequence-timeline-simple` 不单独绘制 `time`，所以把日期明确写入标签；其他模板也要实际核对 time 是否显示。若时间间隔长短很重要，时间线装饰布局不等于等比例时间轴，应考虑 Gantt 或 Vega-Lite。

## 替换模式

- 简短步骤：横向 sequence/list-arrow；有长解释时选纵向模板，如 `sequence-roadmap-vertical-plain-text`。
- 并列要点多：网格比横向长条更适合文档；不要一味缩小字体。
- 循环过程：仅在回到起点有业务含义时使用 circular 模板。
- 漏斗/金字塔：只有存在筛选递减或层级含义时使用，不为了装饰把任意列表画成漏斗。

## 内容与版面检查

核对顺序、日期和文字层级；每项只保留一个主意思。若某项比其他项长很多，先拆分或将说明移到正文。模板选择可参考 [template-catalog.md](template-catalog.md)。
