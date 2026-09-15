# Scatterplots and heatmaps

Scatterplots explain covariation between two variables; heatmaps show intensity across two categorical dimensions. These samples illustrate structure, not evidence of causation.

## Scatterplot

Each point must use the same observation unit, with x/y from the same record. Do not join separately aggregated values by row position.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Document length and processing time (example)",
  "width": "container",
  "height": 240,
  "data": {
    "values": [
      {
        "pages": 3,
        "seconds": 2,
        "kind": "Text only"
      },
      {
        "pages": 8,
        "seconds": 4,
        "kind": "Text only"
      },
      {
        "pages": 12,
        "seconds": 6,
        "kind": "Text only"
      },
      {
        "pages": 5,
        "seconds": 7,
        "kind": "With charts"
      },
      {
        "pages": 9,
        "seconds": 11,
        "kind": "With charts"
      },
      {
        "pages": 14,
        "seconds": 15,
        "kind": "With charts"
      }
    ]
  },
  "mark": {
    "type": "point",
    "filled": true,
    "size": 100,
    "opacity": 0.8
  },
  "encoding": {
    "x": {
      "field": "pages",
      "type": "quantitative",
      "title": "Pages"
    },
    "y": {
      "field": "seconds",
      "type": "quantitative",
      "title": "Processing time (seconds)"
    },
    "color": {
      "field": "kind",
      "type": "nominal",
      "title": "Document type",
      "legend": {
        "orient": "top"
      },
      "scale": {
        "domain": [
          "Text only",
          "With charts"
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

## Two-dimensional heatmap

Encode values with color and a clear legend; explicitly order ordinal categories.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Tasks by time slot (example)",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "day": "Monday",
        "period": "Morning",
        "tasks": 12
      },
      {
        "day": "Monday",
        "period": "Afternoon",
        "tasks": 20
      },
      {
        "day": "Tuesday",
        "period": "Morning",
        "tasks": 18
      },
      {
        "day": "Tuesday",
        "period": "Afternoon",
        "tasks": 9
      },
      {
        "day": "Wednesday",
        "period": "Morning",
        "tasks": 7
      },
      {
        "day": "Wednesday",
        "period": "Afternoon",
        "tasks": 15
      }
    ]
  },
  "mark": "rect",
  "encoding": {
    "x": {
      "field": "day",
      "type": "ordinal",
      "sort": [
        "Monday",
        "Tuesday",
        "Wednesday"
      ],
      "title": null,
      "axis": {
        "labelAngle": 0
      }
    },
    "y": {
      "field": "period",
      "type": "ordinal",
      "sort": [
        "Morning",
        "Afternoon"
      ],
      "title": null
    },
    "color": {
      "field": "tasks",
      "type": "quantitative",
      "title": "Tasks",
      "scale": {
        "zero": true,
        "range": [
          "#E6F4FF",
          "#91CAFF",
          "#4096FF",
          "#1677FF",
          "#0958D9"
        ],
        "interpolate": "rgb"
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

## Refinement and validation

For overlapping points, adjust opacity or aggregate into bins; do not add unexplained random jitter. Verify outliers against their source rather than deleting them for appearance. State the model and sample scope for a regression line; it does not establish causation.

Use diverging colors around a meaningful center, usually zero, for signed deviations; use sequential colors for absolute quantities. Missing cells must not appear as known zero values. Do not map different units to the same color scale.

Official references: [Point](https://vega.github.io/vega-lite/docs/point.html), [Rect](https://vega.github.io/vega-lite/docs/rect.html), [Scale](https://vega.github.io/vega-lite/docs/scale.html).
