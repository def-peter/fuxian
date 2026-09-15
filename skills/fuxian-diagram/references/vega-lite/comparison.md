# 比较与排名

用于回答“哪个更多、相差多少”。先确认比较对象、同一度量、时间窗口与单位；长类别名称优先横向条形。以下数据仅用于示例，不代表业务结论。

## 排名条形

数量使用零基线，按值排序。明确图题与单位，必要时在正文提供精确值。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "渠道订单数（示例）",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "channel": "自然访问",
        "orders": 120
      },
      {
        "channel": "推荐访问",
        "orders": 75
      },
      {
        "channel": "广告访问",
        "orders": 96
      }
    ]
  },
  "mark": {
    "type": "bar",
    "color": "#1677FF"
  },
  "encoding": {
    "y": {
      "field": "channel",
      "type": "nominal",
      "sort": "-x",
      "title": null
    },
    "x": {
      "field": "orders",
      "type": "quantitative",
      "title": "订单数（笔）",
      "scale": {
        "zero": true
      }
    }
  },
  "config": {
    "axis": {
      "labelFontSize": 12,
      "titleFontSize": 13,
      "tickCount": 6
    },
    "legend": {
      "labelFontSize": 12,
      "titleFontSize": 13
    },
    "title": {
      "fontSize": 16
    },
    "header": {
      "labelFontSize": 12,
      "titleFontSize": 13
    },
    "mark": {
      "color": "#1677FF"
    },
    "text": {
      "color": "#262626"
    },
    "range": {
      "category": [
        "#1677FF",
        "#13C2C2",
        "#722ED1",
        "#52C41A",
        "#EB2F96"
      ]
    }
  }
}
```

## 同一类别的多个系列

并排柱形适合比较计划与实际、今年与去年。用 `xOffset` 分组，`color` 说明系列，不把两个系列堆叠成不成立的总量。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "计划与实际（示例）",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "quarter": "Q1",
        "series": "计划",
        "value": 100
      },
      {
        "quarter": "Q1",
        "series": "实际",
        "value": 90
      },
      {
        "quarter": "Q2",
        "series": "计划",
        "value": 120
      },
      {
        "quarter": "Q2",
        "series": "实际",
        "value": 130
      },
      {
        "quarter": "Q3",
        "series": "计划",
        "value": 140
      },
      {
        "quarter": "Q3",
        "series": "实际",
        "value": 125
      }
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": {
      "field": "quarter",
      "type": "ordinal",
      "sort": [
        "Q1",
        "Q2",
        "Q3"
      ],
      "axis": {
        "labelAngle": 0
      },
      "title": "季度"
    },
    "xOffset": {
      "field": "series",
      "sort": [
        "计划",
        "实际"
      ]
    },
    "y": {
      "field": "value",
      "type": "quantitative",
      "title": "交付量（份）",
      "scale": {
        "zero": true
      }
    },
    "color": {
      "field": "series",
      "type": "nominal",
      "title": "系列",
      "scale": {
        "domain": [
          "计划",
          "实际"
        ],
        "range": [
          "#91CAFF",
          "#1677FF"
        ]
      },
      "legend": {
        "orient": "top"
      }
    }
  },
  "config": {
    "axis": {
      "labelFontSize": 12,
      "titleFontSize": 13,
      "tickCount": 6
    },
    "legend": {
      "labelFontSize": 12,
      "titleFontSize": 13
    },
    "title": {
      "fontSize": 16
    },
    "header": {
      "labelFontSize": 12,
      "titleFontSize": 13
    },
    "mark": {
      "color": "#1677FF"
    },
    "text": {
      "color": "#262626"
    },
    "range": {
      "category": [
        "#1677FF",
        "#13C2C2",
        "#722ED1",
        "#52C41A",
        "#EB2F96"
      ]
    }
  }
}
```

## 判断与排错

- 排名与时间顺序冲突时，以读者问题为准；趋势不能按数值排序。
- 同比/环比要写清基期，百分比变化不等于百分点差。
- 分类过多时先聚合或按任务选择 top N，说明其余项如何处理，不静默删去重要类别。
- 正负差值图应保留零线与正负方向；柱形截断轴会夸大差异。
- 标签裁切时改为横向条形、加大左边留白或缩短文案，不隐藏区分类别所需的信息。

官方参考：[Bar](https://vega.github.io/vega-lite/docs/bar.html)、[Offset](https://vega.github.io/vega-lite/docs/encoding.html)。
