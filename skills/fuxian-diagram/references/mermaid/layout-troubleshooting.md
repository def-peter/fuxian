# Mermaid layout and troubleshooting

| Symptom                            | Common cause                                             | Correction                                                          |
| ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| First-line parse failure           | Misspelled declaration or mixed diagram grammars         | Confirm the type and put the declaration on its own line            |
| Parentheses in labels cause errors | Unquoted special characters                              | Use `node["Text (detail)"]`; separate stable IDs from copy          |
| Error near `end`                   | Keyword used as ID or missing group closure              | Rename the ID and check `subgraph/alt/loop` closures at every level |
| Unexpected circle/cross arrowhead  | Edge immediately followed by an ID starting with o/x     | Add whitespace between edge and ID; check the target arrow syntax   |
| Colors do not apply                | CSS braces or semicolon-separated properties in classDef | Separate properties with commas and check class assignment          |
| Subgraph direction has no effect   | Internal nodes connect outside, inheriting parent layout | Adjust overall direction/grouping and inspect the actual layout     |
| HTML labels are missing            | Strict security or target-version differences            | Use simple text and supported tags; retain strict security          |
| Incorrect sequence activation      | Repeated deactivate inside branches                      | Pair activation scopes; omit nonessential activations when needed   |

## Special checks for local rendering

- If class/ER cardinalities or edge labels are clipped, try `config.htmlLabels: false` in source frontmatter to use SVG text, then inspect all labels. Do not lower securityLevel.
- If cross-group edges run through group titles, an overview can connect group boundaries. Retain real edges for action-level precision, adjusting layout or separating detail views.
- If a Gantt chart's native width is excessive, try `config.gantt.useWidth` with fontSize and barHeight, and set an explicit tickInterval to avoid repeated date ticks.

## Layout principles

Reduce cross-layer edges and redundant nodes before changing direction. Keep process and architecture edge labels short; explain longer terms in prose or captions. Retain key fields in class/ER diagrams and shorten sequence participant names. Explain colors and line styles in a legend; icons and emoji are optional unless requested.

Inspect actual SVG text, background, and border contrast. Styling commands differ by diagram type; flowchart `classDef` is not a universal color API.

## Verification scope

`parse` confirms syntax only; rendering exposes automatic-layout, font, and size problems. Recheck the sanitized result in Fuxian at the target width. Use `mmdc` only where available; it is not a prerequisite for installing this skill.

See [validation.md](../validation.md) for shared artifact checks.
