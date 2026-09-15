# PlantUML

Prefer PlantUML by default for process, structural, and interaction modeling. New diagrams default to `!theme mars`; explicit styles and existing source conventions take priority.

## Diagram types with local guides

Use the table to identify a suitable diagram type, then read its guide and adapt a complete example. Read troubleshooting guidance when rendering or layout problems arise. Load only the relevant branches.

| Diagram type or task                                | Guide                                                             | Coverage                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Activity / flowchart; swimlanes                     | [activity-swimlanes.md](plantuml/activity-swimlanes.md)           | Activities, swimlanes, connector clarity, and complete examples       |
| Sequence                                            | [sequence.md](plantuml/sequence.md)                               | Sequences, synchronous branches, and idempotent consumption           |
| State                                               | [state.md](plantuml/state.md)                                     | States, nested states, and event conditions                           |
| Class; ER (Information Engineering)                 | [class-er.md](plantuml/class-er.md)                               | Class and ER diagrams; inheritance, composition, primary/foreign keys |
| Component; deployment                               | [architecture-deployment.md](plantuml/architecture-deployment.md) | Components and deployment; logical versus physical views              |
| Use case; object; package                           | [use-case-object-package.md](plantuml/use-case-object-package.md) | Use case, object, and package diagrams; three separate examples       |
| Mindmap; WBS                                        | [mindmap-wbs.md](plantuml/mindmap-wbs.md)                         | Mindmaps and WBS with dedicated start/end syntax                      |
| Render errors, unbalanced dimensions, fonts, themes | [layout-troubleshooting.md](plantuml/layout-troubleshooting.md)   | Layout parameters, common failures, and correction order              |

Coverage terms follow the [selection inventory](selection-guide.md#diagram-type-inventory).

## Further engine families: verify the configured service

The [official diagram index](https://plantuml.com/) also documents these candidates. They have no complete local guide here; service version, available libraries, dedicated start/end markers, and SVG output must be verified before delivery.

| Type                        | Use when the content requires                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Timing                      | Signal or state values over a shared time axis, durations, and timing constraints                                             |
| Gantt; chronology           | Task schedules/dependencies; dated events rather than request/response messages                                               |
| Network (nwdiag); ArchiMate | Network segments and hosts; enterprise architecture viewpoints                                                                |
| Wireframe (Salt)            | A schematic UI structure rather than a finished application design                                                            |
| JSON; YAML                  | Visual inspection of structured-data nesting                                                                                  |
| EBNF; regex                 | Grammar production rules or regular-expression structure                                                                      |
| Chen ER                     | Conceptual entities, attributes, and relationships in Chen notation; the local ER guide uses Information Engineering notation |
| Ditaa; SDL                  | ASCII-art block diagrams; specification/description-language flows                                                            |
| Files; chart                | File-tree structure; PlantUML-specific numeric charts when explicitly requested                                               |

C4-style modeling can use the server's available standard library; verify library inclusion and macros rather than treating C4 as an ordinary built-in declaration. Default to mars where supported, then verify the specialized diagram's actual appearance.

## Shared constraints

- Use paired `@startuml` / `@enduml` for ordinary UML. Preserve dedicated markers for specialized types such as mindmaps while keeping the `plantuml` fence.
- Use standard PlantUML syntax and stable aliases. `mxgraph.*` is a product-specific extension, not standard Fuxian syntax.
- Source is sent to the configured service. Fonts and include libraries must be available on that server; do not infer availability from the local machine.
- Select correct relationship semantics and abstraction levels before adjusting local styles on top of mars.
