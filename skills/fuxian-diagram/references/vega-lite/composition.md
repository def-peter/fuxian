# Composition and shares

Establish the denominator and whether parts are mutually exclusive and cover the same population. Duplicate counts, negative values, or mixed units cannot be directly represented as a pie or normalized stack.

## Normalized stacks

Compare internal composition across populations. Normalization hides differences in total size; include totals when needed.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Task status shares (example)",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "batch": "Batch 1",
        "state": "Completed",
        "count": 80
      },
      {
        "batch": "Batch 1",
        "state": "Failed",
        "count": 20
      },
      {
        "batch": "Batch 2",
        "state": "Completed",
        "count": 180
      },
      {
        "batch": "Batch 2",
        "state": "Failed",
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
        "Batch 1",
        "Batch 2"
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
      "title": "Share within batch"
    },
    "color": {
      "field": "state",
      "type": "nominal",
      "title": "Status",
      "scale": {
        "domain": [
          "Completed",
          "Failed"
        ],
        "range": [
          "#52C41A",
          "#F5222D"
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

## Donut chart for a few categories

Suitable for a brief composition summary; prefer bars for precise comparison. Explain categories in the legend and prose rather than displaying only colored percentages.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Support channel mix (example)",
  "width": 300,
  "height": 220,
  "data": {
    "values": [
      {
        "channel": "Online chat",
        "requests": 60
      },
      {
        "channel": "Email",
        "requests": 25
      },
      {
        "channel": "Phone",
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
      "title": "Channel",
      "legend": {
        "orient": "bottom"
      },
      "scale": {
        "domain": [
          "Online chat",
          "Email",
          "Phone"
        ],
        "range": [
          "#1677FF",
          "#13C2C2",
          "#722ED1"
        ]
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

## Validation

Shares are undefined when the total is zero; preserve the meaning of “no data/no tasks.” A field already scaled to 0–100 must not use `.0%` directly, which expects 0–1. If rounding produces 99% or 101%, explain rounding or adjust display precision rather than changing raw values.

Only stack segments sharing a baseline are easy to compare precisely. Use grouped bars or facets when changes in middle segments matter.

Official references: [Stack](https://vega.github.io/vega-lite/docs/stack.html), [Arc](https://vega.github.io/vega-lite/docs/arc.html).
