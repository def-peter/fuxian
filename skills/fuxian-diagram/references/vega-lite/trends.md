# Time trends and cumulative values

Explain how and when values change. Establish date granularity, timezone, interval regularity, and missing periods. These examples use UTC scales so local timezones do not shift date boundaries away from ticks. Use the user's timezone conventions for actual data.

## Multiple line series

Use a `temporal` axis and group by `color`, preserving each series' records. Point markers distinguish observations from connecting lines.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Monthly processing volume (example)",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "month": "2026-01-01",
        "team": "Team A",
        "count": 40
      },
      {
        "month": "2026-02-01",
        "team": "Team A",
        "count": 48
      },
      {
        "month": "2026-03-01",
        "team": "Team A",
        "count": 44
      },
      {
        "month": "2026-01-01",
        "team": "Team B",
        "count": 30
      },
      {
        "month": "2026-02-01",
        "team": "Team B",
        "count": 36
      },
      {
        "month": "2026-03-01",
        "team": "Team B",
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
      "title": "Month",
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
      "title": "Volume (items)",
      "scale": {
        "zero": true
      }
    },
    "color": {
      "field": "team",
      "type": "nominal",
      "title": "Team",
      "legend": {
        "orient": "top"
      },
      "scale": {
        "domain": [
          "Team A",
          "Team B"
        ],
        "range": [
          "#1677FF",
          "#13C2C2"
        ]
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

## Cumulative values

Sort by date before calculating a running sum. Do not label per-period values as cumulative without transforming them.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Cumulative completions (example)",
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
    "color": "#1677FF",
    "opacity": 0.75,
    "line": true
  },
  "encoding": {
    "x": {
      "field": "day",
      "type": "temporal",
      "title": "Date",
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
      "title": "Cumulative completions (items)",
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

## Preventing misinterpretation and layout problems

- No observation does not mean zero. Use the source to decide whether to leave a gap, explicitly fill zero, or label missing data; do not let lines conceal gaps.
- Use the same scale when comparing group trends. Independent scales need an explicit purpose and labeling.
- Date strings must be parseable. Standardize cross-timezone data first; avoid misleading hours when only calendar months matter.
- Facet numerous, heavily crossing series with shared coordinates; see [transforms-facets.md](transforms-facets.md).
- Area fill emphasizes totals or composition, usually requiring a zero baseline. Do not stack unrelated series.

Official references: [Line](https://vega.github.io/vega-lite/docs/line.html), [Window](https://vega.github.io/vega-lite/docs/window.html).
