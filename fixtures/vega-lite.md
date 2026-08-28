# Vega-Lite visualization

正文应当立即可读，数据图表随后在原位置完成呈现。

```vega-lite
{
  "description": "季度收入",
  "width": 420,
  "height": 220,
  "data": {
    "values": [
      { "quarter": "第一季度", "revenue": 128 },
      { "quarter": "第二季度", "revenue": 176 },
      { "quarter": "第三季度", "revenue": 154 },
      { "quarter": "第四季度", "revenue": 218 }
    ]
  },
  "mark": { "type": "bar", "color": "#0052cc" },
  "encoding": {
    "x": { "field": "quarter", "type": "nominal", "title": "季度" },
    "y": { "field": "revenue", "type": "quantitative", "title": "收入" }
  }
}
```

## 被阻止的不确定表达式

```vega-lite
{
  "data": { "values": [{ "value": 1 }] },
  "transform": [{ "calculate": "random()", "as": "unstable" }],
  "mark": "point",
  "encoding": {
    "x": { "field": "value", "type": "quantitative" },
    "y": { "field": "unstable", "type": "quantitative" }
  }
}
```

## 被阻止的数据源

```vega-lite
{
  "data": { "url": "https://example.test/private.json" },
  "mark": "line"
}
```
