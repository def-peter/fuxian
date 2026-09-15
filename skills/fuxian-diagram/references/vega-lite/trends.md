# 时间趋势与累计量

用于回答“随时间如何变化、何时变化”。先确定日期粒度、时区、是否等间隔与缺失期。以下为示例数据，日期使用 UTC 比例尺，避免本地时区将日期边界推离刻度。真实数据按用户口径确定时区。

## 多系列折线

使用 `temporal` 日期轴，`color` 分组，每条线保持自己的数据序列。点标记帮助区分真实观测点与连线。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "每月处理量（示例）",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "month": "2026-01-01",
        "team": "一组",
        "count": 40
      },
      {
        "month": "2026-02-01",
        "team": "一组",
        "count": 48
      },
      {
        "month": "2026-03-01",
        "team": "一组",
        "count": 44
      },
      {
        "month": "2026-01-01",
        "team": "二组",
        "count": 30
      },
      {
        "month": "2026-02-01",
        "team": "二组",
        "count": 36
      },
      {
        "month": "2026-03-01",
        "team": "二组",
        "count": 41
      }
    ]
  },
  "mark": {
    "type": "line",
    "point": true
  },
  "encoding": {
    "x": {
      "field": "month",
      "type": "temporal",
      "title": "月份",
      "axis": {
        "format": "%Y-%m",
        "tickCount": 3,
        "labelAngle": 0
      },
      "scale": {
        "type": "utc"
      }
    },
    "y": {
      "field": "count",
      "type": "quantitative",
      "title": "处理量（件）",
      "scale": {
        "zero": true
      }
    },
    "color": {
      "field": "team",
      "type": "nominal",
      "title": "团队",
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

## 累计量

累计曲线需要先按日期排序，再计算累计和；不能把每期数值直接贴上“累计”标题。

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "累计完成量（示例）",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "day": "2026-09-01",
        "completed": 4
      },
      {
        "day": "2026-09-02",
        "completed": 7
      },
      {
        "day": "2026-09-03",
        "completed": 3
      },
      {
        "day": "2026-09-04",
        "completed": 6
      }
    ]
  },
  "transform": [
    {
      "window": [
        {
          "op": "sum",
          "field": "completed",
          "as": "cumulative"
        }
      ],
      "sort": [
        {
          "field": "day",
          "order": "ascending"
        }
      ],
      "frame": [
        null,
        0
      ]
    }
  ],
  "mark": {
    "type": "area",
    "color": "#426B87",
    "opacity": 0.75,
    "line": true
  },
  "encoding": {
    "x": {
      "field": "day",
      "type": "temporal",
      "title": "日期",
      "axis": {
        "format": "%m-%d",
        "tickCount": 4
      },
      "scale": {
        "type": "utc"
      }
    },
    "y": {
      "field": "cumulative",
      "type": "quantitative",
      "title": "累计完成（件）",
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
    }
  }
}
```

## 误读防护与排版

- 没有观测不等于零；根据来源决定留空、明确补零还是标注缺测，避免连线掩盖数据缺口。
- 比较各组趋势时保持同一刻度；独立刻度需有明确目的与标注。
- 日期字符串须可解析，跨时区数据先统一口径。只关心日历月份时避免显示误导性的小时。
- 系列过多且交叉严重时分面，保持相同坐标，详见 [transforms-facets.md](transforms-facets.md)。
- 面积图的填充强调总量或组成，零基线通常必要；不相关系列不宜堆叠。

官方参考：[Line](https://vega.github.io/vega-lite/docs/line.html)、[Window](https://vega.github.io/vega-lite/docs/window.html)。
