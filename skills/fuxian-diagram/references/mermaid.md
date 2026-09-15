# Mermaid

Use Mermaid when the user requests it, when maintaining existing Mermaid content, or when the target environment requires it. Load by diagram type; do not transfer syntax between incompatible declarations.

## Diagram types with local guides

Use the table to identify a suitable diagram type, then read its guide and adapt a complete example. Read troubleshooting guidance when rendering or layout problems arise. Load only the relevant branches.

| Diagram type or task                                                    | Guide                                                            | Coverage                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------ |
| Flowchart                                                               | [flowchart.md](mermaid/flowchart.md)                             | Flowcharts, conditional loops, and groups              |
| Sequence                                                                | [sequence.md](mermaid/sequence.md)                               | Sequence diagrams, message types, and fragments        |
| State; class; ER                                                        | [state-class-er.md](mermaid/state-class-er.md)                   | State, class, and ER diagrams; three complete examples |
| Architecture overview using flowchart groups                            | [architecture-deployment.md](mermaid/architecture-deployment.md) | Layers and code evidence using ordinary flowcharts     |
| Mindmap; Gantt                                                          | [mindmap-gantt.md](mermaid/mindmap-gantt.md)                     | Mindmaps and Gantt; hierarchy versus dependencies      |
| Declaration errors, label problems, group direction, ineffective styles | [layout-troubleshooting.md](mermaid/layout-troubleshooting.md)   | Syntax pitfalls and finished-layout checks             |

Coverage terms follow the [selection inventory](selection-guide.md#diagram-type-inventory).

## Further engine families: check the target version

The following families are registered in the inspected Mermaid 11.17.2 package but lack local authoring guides/rendered verification in this skill. Consult the [official syntax index](https://mermaid.ai/open-source/intro/) for the matching type, then check its declaration in the target version and render it in Fuxian. Registration alone does not prove usable output.

| Type                                      | Use when the content requires                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Native swimlanes                          | Role-based process lanes; distinct from flowchart subgraphs                                    |
| User journey; timeline                    | Experience stages and scores; dated events                                                     |
| Pie; quadrant; XY; radar                  | Part-to-whole shares; two-axis positioning; Cartesian values; comparable multivariate profiles |
| Requirement                               | Requirements and typed traceability relationships                                              |
| Git graph                                 | Branching and merging history                                                                  |
| C4; native architecture; block            | C4 abstractions; infrastructure/service topology; explicit block arrangement                   |
| Sankey                                    | Weighted transfers between stages, with actual flow values                                     |
| Packet                                    | Bit/byte field layouts of protocol packets                                                     |
| Kanban                                    | Work items grouped by workflow status                                                          |
| Treemap; Venn; tree view                  | Hierarchical area allocation; set intersections; nested tree listings                          |
| Event modeling; Ishikawa                  | Event-centered system behavior; cause-and-effect/fishbone analysis                             |
| Wardley; Cynefin                          | Evolution/value-chain mapping; decision contexts classified by complexity                      |
| Railroad (including EBNF/ABNF/PEG inputs) | Grammar productions as syntax diagrams; confirm the exact input dialect                        |

The live documentation may target a newer major release. For example, a listed use-case type must be checked against the installed package rather than inferred from the website. ZenUML requires an external integration and is not registered by the inspected Fuxian runtime; do not emit `zenuml` expecting the ordinary Mermaid bundle to handle it. The local architecture guide deliberately uses flowcharts and does not validate native architecture or C4 syntax.

## Shared constraints

- Separate IDs from labels. Double-quote flowchart labels containing special characters, for example `node["Payment service (with retries)"]`.
- Verify declarations, arrows, grouping, and colors against the diagram type and target version. Flowchart styling is not a universal API for all diagram types.
- Fuxian uses strict security. The diagram's core meaning must not depend on callbacks or arbitrary HTML.
- Validate source parsing and final-layout readability separately.
