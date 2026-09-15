# Binary comparison, SWOT, and quadrants

Use for option tradeoffs, viewpoint classification, and decision overviews. Establish consistent comparison dimensions first; prefer Vega-Lite or a nearby table for precise comparison of quantitative metrics.

## Binary comparison (example)

```infographic
infographic compare-hierarchy-left-right-circle-node-plain-text
data
  title Two delivery formats
  compares
    - label Online document
      children
        - label Timely updates
        - label Requires access
    - label PDF file
      children
        - label Updates need resending
        - label Readable offline
```

This template displays both root option names. Some `compare-binary-*` templates show only children with fixed PROS/CONS or VS decoration; do not assume root labels are visible. Each root represents an option and its children cover the same dimensions: updates, then access/distribution constraints here. Avoid biased comparisons that list benefits on one side and unrelated descriptions on the other.

## SWOT (example)

```infographic
infographic compare-quadrant-quarter-simple-card
data
  title New service SWOT (example)
  compares
    - label Strengths
      desc Fast response
    - label Weaknesses
      desc Small team
    - label Opportunities
      desc Growing demand
    - label Threats
      desc More competition
```

The four-cell layout directly displays the SWOT dimensions and points. Default `compare-swot` uses four columns, which may shrink children excessively in narrow documents. Choose by target layout rather than template name alone. Strengths/weaknesses are internal; opportunities/threats are external. Classify from supplied material rather than inventing market facts to fill four cells.

## Four quadrants (example)

```infographic
infographic compare-quadrant-quarter-simple-card
design
  item
    type quarter-simple-card
    width 260
data
  title Classify benefit and effort (example)
  compares
    - label High benefit, low effort
      desc Prioritize
    - label High benefit, high effort
      desc Plan dedicated work
    - label Low benefit, low effort
      desc Handle when convenient
    - label Low benefit, high effort
      desc Invest cautiously
```

The wider cards keep these English labels on one line without overlapping their descriptions. Recheck wrapping after changing copy or language. This is a four-category overview, not a scatterplot with actual coordinates. For scoring and positioning tasks, establish score data and coordinate semantics, then use a chart supporting accurate positions.

## Layout and validation

Binary templates need two root items. For more options, choose a suitable multi-column template or split the diagram. Verify all four SWOT/quadrant dimensions and their agreement with actual positions. Keep cards concise; put evidence, exceptions, and decision rationale in nearby prose.
