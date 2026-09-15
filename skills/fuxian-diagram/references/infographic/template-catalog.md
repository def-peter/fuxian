# Template selection catalog

This is a task-oriented candidate set for exact selection, not a mirror of every official template. Names were checked against Fuxian's `@antv/infographic` 0.2.20 registry; after upgrades, verify against the target runtime.

| User content                 | Candidate template                                    | Selection condition                                                                                      |
| ---------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| A few short points           | `list-row-simple-horizontal-arrow`                    | Short horizontal steps or linked points                                                                  |
| Points with icons            | `list-row-horizontal-icon-arrow`                      | Icons help distinguish roles/categories                                                                  |
| Several parallel priorities  | `list-grid-badge-card`                                | Grid cards avoid excessive row width                                                                     |
| Simple checklist             | `list-column-done-list`                               | Vertical list for narrow columns                                                                         |
| Several explained steps      | `list-column-simple-vertical-arrow`                   | Vertical arrows, short titles, and descriptions                                                          |
| A few milestones             | `sequence-timeline-simple`                            | Dates/stages are central                                                                                 |
| Longer roadmap               | `sequence-roadmap-vertical-plain-text`                | Vertical stages and descriptions                                                                         |
| Cyclic relationship          | `sequence-circular-simple`                            | Content genuinely returns to its starting point                                                          |
| Filtering and decrease       | `sequence-funnel-simple`                              | Explicit filtering across stages                                                                         |
| Hierarchical progression     | `sequence-pyramid-simple`                             | Actual hierarchy or progression                                                                          |
| Two options                  | `compare-hierarchy-left-right-circle-node-plain-text` | Displays both root names; children share comparison dimensions                                           |
| SWOT                         | `compare-swot`                                        | Internal strengths/weaknesses and external opportunities/threats; consider four cells for narrow columns |
| Four-quadrant classification | `compare-quadrant-quarter-simple-card`                | Category summary, not accurate data coordinates                                                          |
| Ordinary hierarchy           | `hierarchy-tree-curved-line-rounded-rect-node`        | One root and children                                                                                    |
| Rightward hierarchy          | `hierarchy-tree-lr-curved-line-rounded-rect-node`     | Adequate horizontal space                                                                                |
| Concept map                  | `hierarchy-mindmap-branch-gradient-capsule-item`      | Concept hierarchy with consistent siblings                                                               |
| Static relationships         | `relation-dagre-flow-tb-badge-card`                   | Nodes and labeled relations                                                                              |
| Animated relationships       | `relation-dagre-flow-tb-animated-simple-circle-node`  | Screen presentation with complete static frames                                                          |
| A few comparable values      | `chart-column-simple`                                 | Numeric summary using values                                                                             |
| Keyword summary              | `chart-wordcloud`                                     | Supplied weights and template-specific fields                                                            |

## Verify templates and fields

With access to Fuxian's source environment, resolve `@antv/infographic` from the desktop package. Use `getTemplates()` for names, `getTemplate(name)` for structure/item composition, and `parseSyntax()` for actual data. Template existence establishes only a valid name, not that supplied fields appear.

Then render and check **every expected label, value, and level**. Choose field mappings from the linked guides and target template definitions. Prefixes are hints only; structures such as `hierarchy-structure`, interactive relationships, and word clouds require specific checks.

Without repository dependencies, consult the matching version of the [official documentation](https://infographic.antv.vision/). Users need not understand or select templates first.

## Verified template differences

Put `sequence-timeline-simple` dates in visible labels. `chart-wordcloud` does not draw a title by default, so use adjacent Markdown. Some binary fold templates hide root names and use fixed PROS/CONS decoration; prefer the catalog's compare-hierarchy template for named options. Hierarchy trees may lack a title design and use wide nodes by default; configure them explicitly as shown in the hierarchy guide.
