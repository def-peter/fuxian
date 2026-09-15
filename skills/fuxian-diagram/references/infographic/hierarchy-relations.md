# Hierarchies and relationship networks

A hierarchy is a rooted tree. A relationship graph may have cross-level connections, multiple parents, and cycles. Do not force multiple memberships into a single-root hierarchy.

## Single-root hierarchy (example)

```infographic
infographic hierarchy-tree-lr-curved-line-rounded-rect-node
design
  structure
    type hierarchy-tree
    orientation left-right
    edgeType curved
    edgeColorMode gradient
    edgeMarker none
  title
    type default
  item
    type rounded-rect-node
    width 160
data
  title Report structure
  root
    label Report
    children
      - label Conclusions
        children
          - label Key findings
          - label Recommended actions
      - label Evidence
        children
          - label Data
          - label Method
```

The example explicitly adds a title design and narrower nodes expanding rightward to prevent wide defaults from shrinking all text. There is one `root`; descendants recurse through `children`. Fix skipped levels or mixed sibling classification before styling. Special structures such as `hierarchy-structure` do not follow a universal root rule; check the template definition.

## Relationships with edge labels (example)

```infographic
infographic relation-dagre-flow-tb-badge-card
data
  title Document information flow
  nodes
    - id source
      label Source
    - id render
      label Render
    - id delivery
      label Output
  relations
    source -->|Input| render
    render -->|Output| delivery
```

Use badge-card for readable node names. Small-node templates such as simple-circle-node need extra checks that labels stay visible. Separate node IDs from display text and reference defined IDs. Edge labels state the relationship; adjacency or an arrow alone does not establish containment, dependency, or ordering.

## Complex cases

For a wide tree, choose a verified left/right template or split important branches. Verify each variant's registered name. If relationship edges cross excessively, establish the main relationship and move secondary relationships into detail views.

Prefer PlantUML for strict UML sequence, cardinality, or state semantics. If Infographic is explicit, retain it and explain the simplified representation. Animated edges may help screen presentations, but the static diagram must remain understandable; see [theme-layout.md](theme-layout.md).
