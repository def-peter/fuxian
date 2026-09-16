# Transforms, layers, and facets

Establish the input structure before choosing transform order. Filter changes the sample, aggregate changes the grain, calculate derives fields, and fold converts wide data to long data. Each step may change statistical meaning.

## Aggregate the denominator before computing ratios

Overall conversion is total orders / total visits, not the simple average of daily rates. This example aggregates several days by channel.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Conversion rate by channel (example)",
  "width": "container",
  "height": 180,
  "data": {
    "values": [
      {
        "channel": "Organic",
        "orders": 10,
        "sessions": 100
      },
      {
        "channel": "Organic",
        "orders": 12,
        "sessions": 200
      },
      {
        "channel": "Referral",
        "orders": 20,
        "sessions": 100
      },
      {
        "channel": "Referral",
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
      "title": "Conversion rate",
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

The text layer shares coordinates with the bars. This example reserves room for labels; after changing data, recheck whether text at the maximum value exceeds the plot bounds.

## Inline named data, fold, and facets

Use small multiples for side-by-side comparisons on the same scale. This example arranges teams in rows with a shared y-scale; choose rows or columns according to the comparison and label lengths.

```vega-lite
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Monthly volume by team (example)",
  "datasets": {
    "observations": [
      {
        "month": "2026-01-01",
        "Team A": 12,
        "Team B": 18
      },
      {
        "month": "2026-02-01",
        "Team A": 20,
        "Team B": 21
      },
      {
        "month": "2026-03-01",
        "Team A": 18,
        "Team B": 25
      }
    ]
  },
  "data": {
    "name": "observations"
  },
  "transform": [
    {
      "fold": [
        "Team A",
        "Team B"
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
      "title": "Team"
    }
  },
  "spec": {
    "width": 400,
    "height": 130,
    "mark": {
      "type": "line",
      "point": true,
      "color": "#1677FF"
    },
    "encoding": {
      "x": {
        "field": "month",
        "type": "temporal",
        "title": "Month",
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
        "title": "Volume",
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

## Composition choices

`layer` overlays marks within one coordinate system; `facet` groups records into views by a field; `hconcat/vconcat` combines separate specifications. Establish fields, units, and scales at every level rather than forcing incomparable values together with independent dual axes.

`width: container` is an option for applicable single views/layers, not something to paste into any nested facet. Size faceted/concatenated views according to official rules and inspect the total output width.

Parameters and selections contribute their initial snapshot in Fuxian, not a complete interactive page. Report conclusions must be readable initially rather than hidden behind hover or filtering.

Official references: [Transform](https://vega.github.io/vega-lite/docs/transform.html), [Layer](https://vega.github.io/vega-lite/docs/layer.html), [Facet](https://vega.github.io/vega-lite/docs/facet.html).
