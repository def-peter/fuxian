# 组成与占比

先确认分母与各部分是否互斥且覆盖同一总体。存在重复计数、负值或不同单位时，不能直接使用饼图或百分比堆叠。

## 百分比堆叠

用于比较不同总体的内部组成。归一化之后，总体大小差异不可见；需要时附总量。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "任务状态占比（示例）",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "batch": "第一批",
        "state": "完成",
        "count": 80
      },
      {
        "batch": "第一批",
        "state": "失败",
        "count": 20
      },
      {
        "batch": "第二批",
        "state": "完成",
        "count": 180
      },
      {
        "batch": "第二批",
        "state": "失败",
        "count": 20
      }
    ]
  },
  "mark": "bar",
  "encoding": {
    "y": {
      "field": "batch",
      "type": "ordinal",
      "sort": [
        "第一批",
        "第二批"
      ],
      "title": null
    },
    "x": {
      "field": "count",
      "type": "quantitative",
      "stack": "normalize",
      "axis": {
        "format": ".0%"
      },
      "title": "批次内占比"
    },
    "color": {
      "field": "state",
      "type": "nominal",
      "title": "状态",
      "scale": {
        "domain": [
          "完成",
          "失败"
        ],
        "range": [
          "#426B87",
          "#D18169"
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
    }
  }
}
```

## 少量类别的环形图

适合简短组成摘要；精确比较仍优先条形。图例与正文提供类别含义，不能只显示百分比颜色。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "支持渠道组成（示例）",
  "width": 300,
  "height": 220,
  "data": {
    "values": [
      {
        "channel": "在线咨询",
        "requests": 60
      },
      {
        "channel": "邮件",
        "requests": 25
      },
      {
        "channel": "电话",
        "requests": 15
      }
    ]
  },
  "mark": {
    "type": "arc",
    "innerRadius": 60
  },
  "encoding": {
    "theta": {
      "field": "requests",
      "type": "quantitative"
    },
    "color": {
      "field": "channel",
      "type": "nominal",
      "title": "渠道",
      "legend": {
        "orient": "bottom"
      }
    },
    "order": {
      "field": "requests",
      "type": "quantitative",
      "sort": "descending"
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

## 校验

总量为零时占比没有定义，需要保留“无数据/无任务”的含义。百分比字段若已为 0–100，不能再直接使用期望 0–1 的 `.0%` 格式。舍入造成合计 99% 或 101% 时，说明口径或调整展示精度，不篡改原始值。

堆叠比较中只有共享基线的部分容易精确比较；中间部分的变化重要时改为并排柱形或分面。

官方参考：[Stack](https://vega.github.io/vega-lite/docs/stack.html)、[Arc](https://vega.github.io/vega-lite/docs/arc.html)。
