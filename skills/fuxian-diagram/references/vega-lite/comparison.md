# Comparisons and ranking

Explain which is larger and by how much. Establish comparison subjects, a shared metric, time window, and units. Prefer horizontal bars for long category names. The data below is illustrative, not a business conclusion.

## Ranked bars

Use a zero baseline for counts and sort by value. State the title and units clearly; provide exact values in prose when needed.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Orders by channel (example)",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "channel": "Organic",
        "orders": 120
      },
      {
        "channel": "Referral",
        "orders": 75
      },
      {
        "channel": "Advertising",
        "orders": 96
      }
    ]
  },
  "encoding": {
    "y": {
      "field": "channel",
      "type": "nominal",
      "sort": { "field": "orders", "op": "sum", "order": "descending" },
      "title": null
    },
    "x": {
      "field": "orders",
      "type": "quantitative",
      "title": "Orders (count)",
      "scale": {
        "zero": true
      }
    },
    "tooltip": [
      {
        "field": "channel",
        "type": "nominal",
        "title": "Channel"
      },
      {
        "field": "orders",
        "type": "quantitative",
        "title": "Orders (count)",
        "format": ",.0f"
      }
    ]
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
  },
  "layer": [
    {
      "mark": {
        "type": "bar",
        "color": "#1677FF"
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
          "field": "orders",
          "type": "quantitative",
          "format": ",.0f"
        },
        "color": {
          "value": "#262626"
        }
      }
    }
  ]
}
```

## Multiple series within a category

Grouped bars suit planned/actual or this-year/last-year comparisons. Group with `xOffset` and identify series with `color`; do not stack series into a meaningless total.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Planned versus actual (example)",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "quarter": "Q1",
        "series": "Planned",
        "value": 100
      },
      {
        "quarter": "Q1",
        "series": "Actual",
        "value": 90
      },
      {
        "quarter": "Q2",
        "series": "Planned",
        "value": 120
      },
      {
        "quarter": "Q2",
        "series": "Actual",
        "value": 130
      },
      {
        "quarter": "Q3",
        "series": "Planned",
        "value": 140
      },
      {
        "quarter": "Q3",
        "series": "Actual",
        "value": 125
      }
    ]
  },
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
      "title": "Quarter"
    },
    "xOffset": {
      "field": "series",
      "sort": [
        "Planned",
        "Actual"
      ]
    },
    "y": {
      "field": "value",
      "type": "quantitative",
      "title": "Deliveries (documents)",
      "scale": {
        "zero": true
      }
    },
    "color": {
      "field": "series",
      "type": "nominal",
      "title": "Series",
      "scale": {
        "domain": [
          "Planned",
          "Actual"
        ],
        "range": [
          "#91CAFF",
          "#1677FF"
        ]
      },
      "legend": {
        "orient": "top"
      }
    },
    "tooltip": [
      {
        "field": "quarter",
        "type": "ordinal",
        "title": "Quarter"
      },
      {
        "field": "series",
        "type": "nominal",
        "title": "Series"
      },
      {
        "field": "value",
        "type": "quantitative",
        "title": "Deliveries (documents)",
        "format": ",.0f"
      }
    ]
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
  },
  "layer": [
    {
      "mark": "bar"
    },
    {
      "mark": {
        "type": "text",
        "baseline": "bottom",
        "dy": -4
      },
      "encoding": {
        "text": {
          "field": "value",
          "type": "quantitative",
          "format": ",.0f"
        },
        "color": {
          "value": "#262626"
        }
      }
    }
  ]
}
```

## Decisions and troubleshooting

- If ranking conflicts with chronological order, follow the reader's question; do not sort a time trend by value.
- State the comparison base for year-over-year or period-over-period metrics. Percentage change differs from percentage-point difference.
- For many categories, aggregate or select a task-appropriate top N and explain how remaining categories are handled. Do not silently remove important categories.
- Preserve zero and sign direction in difference charts. Truncated bar axes exaggerate differences.
- For clipped labels, use horizontal bars, more left padding, or shorter copy without hiding text needed to distinguish categories.

Official references: [Bar](https://vega.github.io/vega-lite/docs/bar.html), [Offset](https://vega.github.io/vega-lite/docs/encoding.html).
