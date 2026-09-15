# AntV Infographic

Organize narrative material into a clear information structure, then choose an official template. Let the content determine the template.

## Diagram types with local guides

Use the table to identify a suitable diagram type, then read its guide and adapt a complete example. Read troubleshooting guidance when rendering or layout problems arise. Load only the relevant branches.

| Diagram type or task                                      | Guide                                                        | Coverage                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| Lists/cards; steps; timeline; roadmap                     | [list-sequence.md](infographic/list-sequence.md)             | Lists and sequences; concise copy, time fields, and layout     |
| Binary comparison; SWOT; four quadrants                   | [comparison.md](infographic/comparison.md)                   | Three complete examples, root items, and comparison dimensions |
| Hierarchy / organization tree; relationship graph         | [hierarchy-relations.md](infographic/hierarchy-relations.md) | A single root, children, nodes, and relations                  |
| Column chart; word cloud                                  | [charts.md](infographic/charts.md)                           | Numeric charts, word clouds, and template-specific fields      |
| Custom themes/design, animation, card wrapping, resources | [theme-layout.md](infographic/theme-layout.md)               | Complete design example and diagnosis                          |
| Template selection, exact names, or variants              | [template-catalog.md](infographic/template-catalog.md)       | Verified candidates organized by information structure         |

Coverage terms follow the [selection inventory](selection-guide.md#diagram-type-inventory).

## Template families available for selection

The local catalog provides candidates for six families, including more types than the complete examples. Read [template-catalog.md](infographic/template-catalog.md) for exact names and the distinction between registry checks and visible-field verification.

| Family        | Diagram types and selection use                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `list-*`      | Parallel lists, checklists, rows, grids, and summary cards                                                                     |
| `sequence-*`  | Steps, timelines, roadmaps, cycles, funnels, pyramids, stairs, and interaction sequences; preserve actual order or progression |
| `compare-*`   | Binary option comparison, SWOT, four-quadrant classification, and hierarchical comparison                                      |
| `hierarchy-*` | Trees, organization structures, mindmaps, and structural hierarchies                                                           |
| `relation-*`  | Directed flows, networks, and circular relationships; animated variants still need a meaningful static frame                   |
| `chart-*`     | Column/bar, line, pie/donut, and word cloud; intended for concise numeric or keyword summaries                                 |

Additional exact candidates registered in the inspected 0.2.20 runtime are listed below. They have not received the complete-example layout checks in this skill; inspect their template definitions and data mapping before use.

| Type                        | Candidate                                                           |
| --------------------------- | ------------------------------------------------------------------- |
| Horizontal bar              | `chart-bar-plain-text`                                              |
| Line                        | `chart-line-plain-text`                                             |
| Pie; donut                  | `chart-pie-plain-text`; `chart-pie-donut-plain-text`                |
| Network; circular relations | `relation-network-simple-circle-node`; `relation-circle-icon-badge` |
| Interaction sequence        | `sequence-interaction-default-badge-card`                           |
| Structural hierarchy        | `hierarchy-structure`; `hierarchy-structure-mirror`                 |

Check the [official documentation](https://infographic.antv.vision/) and the target registry after upgrades. A family prefix identifies candidates; the actual template definition determines accepted fields and visible content.

## Shared constraints

- The official DSL uses indentation and `key value`, not JSON or colon-separated YAML.
- Map fields to the actual template. `lists`, `sequences`, `compares`, and `root` have distinct semantics; do not guess a generic items field.
- For ordinary templates, start with `infographic <exact-name>`. See the relevant guide for complete custom-design syntax.
- Fuxian supports official themes, design, and animation. Emit an `infographic` fence; see [capabilities.md](capabilities.md) for resource and snapshot boundaries.
- Template existence, successful parsing, and correct display of all content are separate checks.
