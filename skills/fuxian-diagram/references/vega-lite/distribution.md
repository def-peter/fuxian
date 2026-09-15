# Distributions: histograms and box plots

Explain concentration, spread, and outliers. Establish the observation unit, sample size, and sampling scope. Small illustrative samples explain syntax, not statistical inference.

## Histogram

`bin` groups continuous values; the y-axis counts samples per bin. This differs from an ordinary bar chart counting categories.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Task duration distribution (example)",
  "width": "container",
  "height": 220,
  "data": {
    "values": [
      {
        "seconds": 12
      },
      {
        "seconds": 14
      },
      {
        "seconds": 15
      },
      {
        "seconds": 18
      },
      {
        "seconds": 19
      },
      {
        "seconds": 21
      },
      {
        "seconds": 22
      },
      {
        "seconds": 24
      },
      {
        "seconds": 26
      },
      {
        "seconds": 27
      },
      {
        "seconds": 31
      },
      {
        "seconds": 38
      }
    ]
  },
  "mark": {
    "type": "bar",
    "color": "#1677FF"
  },
  "encoding": {
    "x": {
      "field": "seconds",
      "type": "quantitative",
      "bin": {
        "step": 10
      },
      "title": "Duration (seconds)"
    },
    "y": {
      "aggregate": "count",
      "type": "quantitative",
      "title": "Tasks",
      "axis": {
        "tickMinStep": 1
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

## Box plot

The box displays quartiles and median; `extent` controls whiskers. This example uses 1.5 times the IQR. Observations beyond the whiskers are plotted as outliers, not automatically classified as invalid data.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Duration by queue (example)",
  "width": "container",
  "height": 240,
  "data": {
    "values": [
      {
        "queue": "Fast queue",
        "seconds": 8
      },
      {
        "queue": "Fast queue",
        "seconds": 9
      },
      {
        "queue": "Fast queue",
        "seconds": 11
      },
      {
        "queue": "Fast queue",
        "seconds": 12
      },
      {
        "queue": "Fast queue",
        "seconds": 13
      },
      {
        "queue": "Fast queue",
        "seconds": 16
      },
      {
        "queue": "Fast queue",
        "seconds": 20
      },
      {
        "queue": "Standard queue",
        "seconds": 14
      },
      {
        "queue": "Standard queue",
        "seconds": 18
      },
      {
        "queue": "Standard queue",
        "seconds": 20
      },
      {
        "queue": "Standard queue",
        "seconds": 23
      },
      {
        "queue": "Standard queue",
        "seconds": 27
      },
      {
        "queue": "Standard queue",
        "seconds": 29
      },
      {
        "queue": "Standard queue",
        "seconds": 50
      }
    ]
  },
  "mark": {
    "type": "boxplot",
    "extent": 1.5
  },
  "encoding": {
    "x": {
      "field": "queue",
      "type": "nominal",
      "title": "Queue",
      "axis": {
        "labelAngle": 0
      }
    },
    "y": {
      "field": "seconds",
      "type": "quantitative",
      "title": "Duration (seconds)",
      "scale": {
        "zero": true
      }
    },
    "color": {
      "field": "queue",
      "type": "nominal",
      "legend": null,
      "scale": {
        "domain": [
          "Fast queue",
          "Standard queue"
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

## Selection and validation

Use histograms for distribution shape and box plots to compare group summaries. Box plots hide multimodality; add sample points or histograms when needed. State group sample sizes rather than inferring counts from box width.

Bin boundaries affect interpretation. Prefer an explicit step when business thresholds are fixed; automatic binning helps exploration, but record the definition for delivery. `aggregate: count` counts rows; sum frequency fields when data is already aggregated.

Official references: [Bin](https://vega.github.io/vega-lite/docs/bin.html), [Boxplot](https://vega.github.io/vega-lite/docs/boxplot.html).
