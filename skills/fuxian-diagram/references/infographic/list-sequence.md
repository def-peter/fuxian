# Key points, steps, and milestones

Use lists for parallel ideas and sequences for explicit order, dates, or stages. Make item granularity consistent before choosing horizontal, vertical, or grid layout.

## Parallel points (example)

```infographic
infographic list-grid-badge-card
data
  title Report delivery priorities
  lists
    - label Content
      desc Evidence-based
      icon lucide/file-text
    - label Structure
      desc Clear hierarchy
      icon lucide/list-tree
    - label Diagrams
      desc Highlight key points
      icon lucide/chart-bar
    - label Validation
      desc Readable output
      icon lucide/check
```

Items should be readable as peers. Labels name categories and desc supplies specifics; do not mix a department, action, time, and conclusion as four parallel items.

## Timeline (example)

```infographic
infographic sequence-timeline-simple
data
  title Project delivery milestones
  desc Illustrative dates
  sequences
    - label 09-01 Define scope
      desc Confirm reading goals
    - label 09-05 Finish draft
      desc Organize evidence
    - label 09-10 Deliver
      desc Check final layout
```

The current `sequence-timeline-simple` does not draw `time` separately, so dates belong in visible labels. Verify time visibility for other templates too. Decorative timeline layout is not a proportional time axis; consider Gantt or Vega-Lite when interval lengths matter.

## Alternative patterns

- Short steps: horizontal sequence/list-arrow. For longer explanations, choose a vertical template such as `sequence-roadmap-vertical-plain-text`.
- Many parallel points: a grid suits documents better than an excessively wide row; avoid repeatedly shrinking fonts.
- Cyclic process: use circular templates only when returning to the beginning has business meaning.
- Funnel/pyramid: use only for actual filtering, decreasing quantities, or hierarchy, not as decoration for an arbitrary list.

## Content and layout checks

Verify order, dates, and text hierarchy. Keep one main idea per item. If one item is much longer, split it or move explanation into prose. See [template-catalog.md](template-catalog.md) for template selection.
