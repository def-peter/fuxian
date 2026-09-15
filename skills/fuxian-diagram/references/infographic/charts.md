# 数字摘要与词云

Infographic 的数字图适合在叙事中突出少量指标；复杂分析、多个精确坐标轴和统计变换用 Vega-Lite。

## 同口径数字摘要（示例）

```infographic
infographic chart-column-simple
data
  title 季度完成量（示例）
  desc 单位：份
  values
    - label Q1
      value 18
    - label Q2
      value 27
    - label Q3
      value 23
```

同一图的数值必须能比较。访问次数和转化率等不同单位不放到同一柱形尺度；如需共同展示，分别使用指标卡或单独图。

## 词云（示例）

反馈主题（示例权重）：

```infographic
infographic chart-wordcloud
data
  items
    - label 清晰
      value 50
    - label 易读
      value 40
    - label 图示
      value 35
    - label 排版
      value 30
    - label 稳定
      value 25
    - label 交付
      value 20
```

该模板默认不显示 title，图题放在相邻 Markdown 中。该模板示例使用 `items`；它是特定模板的已验证用法，不是字段不确定时的通用兜底。字体大小表示给定权重，不能暗示精确面积比例。精确词频比较优先排序条形。

## 校验

数据与单位都显示在正常阅读版面，数值来源或“示例数据”清楚可见。权重由实际频次、用户指定评分或明确说明的示例构成；不要依据视觉需要捏造权重。词云位置变化不承载语义，关键结论仍放在正文。
