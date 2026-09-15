# 数据变换、分层与分面

复杂图先明确输入结构，再决定变换顺序。filter 改变样本，aggregate 改变粒度，calculate 派生字段，fold 将宽表转成长表；任一步都可能改变统计含义。

## 先汇总分母再计算比率

总体转化率应为总订单数 / 总访问数，不是各日转化率的简单平均。示例把多日数据按渠道聚合。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "渠道转化率（示例）",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "channel": "自然访问",
        "orders": 10,
        "sessions": 100
      },
      {
        "channel": "自然访问",
        "orders": 12,
        "sessions": 200
      },
      {
        "channel": "推荐访问",
        "orders": 20,
        "sessions": 100
      },
      {
        "channel": "推荐访问",
        "orders": 15,
        "sessions": 150
      }
    ]
  },
  "transform": [
    {
      "aggregate": [
        {
          "op": "sum",
          "field": "orders",
          "as": "ordersTotal"
        },
        {
          "op": "sum",
          "field": "sessions",
          "as": "sessionsTotal"
        }
      ],
      "groupby": [
        "channel"
      ]
    },
    {
      "calculate": "datum.sessionsTotal > 0 ? datum.ordersTotal / datum.sessionsTotal : null",
      "as": "conversion"
    }
  ],
  "encoding": {
    "y": {
      "field": "channel",
      "type": "nominal",
      "title": null
    },
    "x": {
      "field": "conversion",
      "type": "quantitative",
      "title": "转化率",
      "axis": {
        "format": ".0%"
      },
      "scale": {
        "domain": [
          0,
          0.25
        ]
      }
    }
  },
  "layer": [
    {
      "mark": {
        "type": "bar",
        "color": "#426B87"
      }
    },
    {
      "mark": {
        "type": "text",
        "align": "left",
        "dx": 5
      },
      "encoding": {
        "text": {
          "field": "conversion",
          "type": "quantitative",
          "format": ".1%"
        }
      }
    }
  ],
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
    }
  }
}
```

文字层与柱形共享坐标。示例留出了标签位置；改写数据后需重新检查最大值处的文字是否超出范围。

## 内联命名数据、fold 与分面

需要并排比较同刻度趋势时使用 small multiples。这里按团队分行以适应文档宽度，每个视图使用相同 y 尺度。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "团队月度处理量（示例）",
  "datasets": {
    "observations": [
      {
        "month": "2026-01-01",
        "一组": 12,
        "二组": 18
      },
      {
        "month": "2026-02-01",
        "一组": 20,
        "二组": 21
      },
      {
        "month": "2026-03-01",
        "一组": 18,
        "二组": 25
      }
    ]
  },
  "data": {
    "name": "observations"
  },
  "transform": [
    {
      "fold": [
        "一组",
        "二组"
      ],
      "as": [
        "team",
        "count"
      ]
    }
  ],
  "facet": {
    "row": {
      "field": "team",
      "type": "nominal",
      "title": "团队"
    }
  },
  "spec": {
    "width": 400,
    "height": 130,
    "mark": {
      "type": "line",
      "point": true,
      "color": "#426B87"
    },
    "encoding": {
      "x": {
        "field": "month",
        "type": "temporal",
        "title": "月份",
        "axis": {
          "format": "%m",
          "tickCount": 3
        },
        "scale": {
          "type": "utc"
        }
      },
      "y": {
        "field": "count",
        "type": "quantitative",
        "title": "处理量",
        "scale": {
          "zero": true
        }
      }
    }
  },
  "resolve": {
    "scale": {
      "y": "shared"
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
    }
  }
}
```

## 组合选择

`layer` 叠加同一坐标系内的 mark；`facet` 按字段分组为子视图；`hconcat/vconcat` 组合不同规范。逐层明确字段、单位和比例尺，避免用独立双轴强行叠加不可比较的数值。

`width: container` 是适用单视图/layer 的选择，不能机械贴进任意嵌套 facet。分面、拼接应按官方规则使用子图尺寸，并检查整个成品宽度。

参数与选择器在 Fuxian 中贡献初始快照，不形成完整交互页面。报告结论要在初始状态可读，不能藏在 hover 或筛选操作之后。

官方参考：[Transform](https://vega.github.io/vega-lite/docs/transform.html)、[Layer](https://vega.github.io/vega-lite/docs/layer.html)、[Facet](https://vega.github.io/vega-lite/docs/facet.html)。
