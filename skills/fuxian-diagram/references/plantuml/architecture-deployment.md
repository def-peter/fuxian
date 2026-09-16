# Component architecture and deployment

Components explain responsibilities and dependencies; deployment explains runtime locations and connections. Choose the abstraction level first: system boundary → process/service → internal component. A node must not simultaneously represent a whole business system and a method.

## Components and interfaces (example)

```plantuml
@startuml
!theme mars
title Document processing components
package "Application" {
  component "Document entry" as Entry
  component "Layout service" as Layout
  interface "Rendering contract" as Contract
  component "Markdown renderer" as Markdown
}
Entry --> Layout : Submit source
Layout ..> Contract : depends on
Markdown -- Contract : provides
@enduml
```

Groups represent actual module or system boundaries. `..>` represents dependency, and interface providers connect to the interface. Simplify interface nodes when only coarse flow matters, while preserving dependency direction.

## Deployment and network boundaries (example)

```plantuml
@startuml
!theme mars
title Document service deployment
node "Client" as Client
node "Application host" {
  artifact "Web service" as Web
  artifact "Worker" as Worker
}
queue "Task queue" as Queue
database "Document database" as DB
Client --> Web : HTTPS
Web --> Queue : Submit task
Queue --> Worker : Deliver task
Worker --> DB : Save result
Web --> DB : Query status
@enduml
```

This is an illustrative topology, not actual project configuration. Verify hosts, containers, clusters, ports, protocols, replica counts, and external dependencies from configuration for a real deployment diagram.

## Dataflow with labeled inputs and explained colors

Independent inputs can share a rank instead of being forced into a vertical chain by hidden edges. In this illustrative pipeline, three inputs feed scoring, while observed features also bypass scoring to supply the export snapshot directly. Preserve that bypass when simplifying layout.

```plantuml
@startuml
!theme mars
title Scoring data delivery (example)
top to bottom direction
skinparam defaultFontSize 14
skinparam shadowing false

package "Facts and scoring criteria" {
  database "Observed\nfeatures" as Features #F5F5F5
  database "Category\nreference" as Reference #F5F5F5
  database "Full-score\nbenchmark" as Benchmark #F5F5F5
}
database "Window scores" as Scores #E6F4FF
database "Export snapshot" as Snapshot #E6F4FF
database "Serving table" as Serving #F6FFED
component "Search service" as Search #F6FFED

Features --> Scores : Observations
Reference --> Scores : Reference values
Benchmark --> Scores : Full-score threshold
Features --> Snapshot : Base fields
Scores --> Snapshot : Score fields
Snapshot --> Serving : Synchronize
Serving --> Search : Read factors

legend bottom
  |= Node fill |= Meaning |
  | <back:#F5F5F5>  </back> Gray | Facts and scoring criteria |
  | <back:#E6F4FF>  </back> Blue | Warehouse results and export |
  | <back:#F6FFED>  </back> Green | Serving data and its consumer |
  Arrows show data flow.
endlegend
@enduml
```

The legend explains the author-added fills; names and the input group also carry the meaning. Inspect all seven edge labels against their own connectors, including the base-field bypass. Longer names or a different renderer may need a different arrangement; this example is not a fixed layout recipe. Apply the [edge-label correction sequence](layout-troubleshooting.md#edge-labels-detached-from-their-connectors) when labels drift away from their lines.

## From code to architecture

- Imports establish compile-time dependencies, not runtime access to a node. Read call paths for sequence messages.
- Several replicas of one service can be one node with a replica-count note. Expand availability zones or failure domains only when their differences matter to the task.
- Dataflow and “depends on” arrows mean different things. Prefer one main semantics; when combining them, supply a legend and explicit labels.
- Cloud-provider icons are optional. Standard `node`, `artifact`, and `database` elements explain deployment without environment-specific extensions.
- If there are too many levels or cross-zone edges, separate overview, internal-component, and deployment views; avoid repeating identical information.

See [code-to-diagram.md](../code-to-diagram.md) for source evidence.

Official syntax: [Component](https://plantuml.com/component-diagram), [Deployment](https://plantuml.com/deployment-diagram).
