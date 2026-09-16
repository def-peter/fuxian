# Numeric summaries and word clouds

Infographic charts highlight a few metrics within a narrative. Use Vega-Lite for complex analysis, several precise axes, or statistical transforms.

## Comparable numeric summary (example)

```infographic
infographic chart-column-simple
data
  title Quarterly completions (example)
  desc Unit: documents
  values
    - label Q1
      value 18
    - label Q2
      value 27
    - label Q3
      value 23
```

Values in one chart must be comparable. Do not place visits and conversion rates on the same bar scale; use separate metric cards or charts for different units.

## Word cloud (example)

Feedback topics (illustrative weights):

```infographic
infographic chart-wordcloud
data
  items
    - label Clear
      value 50
    - label Readable
      value 40
    - label Diagrams
      value 35
    - label Layout
      value 30
    - label Stable
      value 25
    - label Delivery
      value 20
```

This template does not display a title by default; put the caption in adjacent Markdown. The example's `items` field is verified for this template, not a generic fallback for uncertain fields. Font size represents the supplied weight, not an exact area ratio. Prefer sorted bars for precise word-frequency comparisons.

## Validation

Data and units must be readable in the chosen layout, with a clear source or “example data” label. Weights come from actual frequencies, user-specified scores, or explicitly illustrative data; do not invent them for appearance. Word positions do not carry meaning, and key conclusions remain in the prose.
