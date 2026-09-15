# Use case, object, and package diagrams

These solve different questions; select the one relevant to the current task.

## Use cases: goals an actor can accomplish

Use cases are neither page lists nor execution sequences. Put capabilities inside the system boundary and actors outside. An `include` arrow points to the required reused use case; an `extend` arrow points to the base use case being extended.

```plantuml
@startuml
!theme mars
left to right direction
title Report delivery use cases
actor "Author" as Author
rectangle "Report system" {
  usecase "Deliver report" as Deliver
  usecase "Check completeness" as Validate
  usecase "Add watermark" as Watermark
}
Author --> Deliver
Deliver ..> Validate : <<include>>
Watermark ..> Deliver : <<extend>>\n[Version marking needed]
@enduml
```

Completeness checking always occurs here; watermarking is conditional. Change the relationships if the real business differs rather than copying the example's assumptions.

## Objects: concrete instances at a moment in time

Use object diagrams to explain instance relationships from an incident or example input; use class diagrams for type responsibilities.

```plantuml
@startuml
!theme mars
title Order snapshot (example)
object "order42 : Order" as Order {
  status = "Awaiting shipment"
  total = 120
}
object "line1 : OrderLine" as Line {
  quantity = 2
  unitPrice = 60
}
Order *-- Line : contains
@enduml
```

These are instance values, not class field declarations. Follow task constraints for redaction and source labeling. Keep example quantity, unit price, and total consistent.

## Packages: module layers and dependencies

```plantuml
@startuml
!theme mars
title Module dependencies
package "UI layer" as UI
package "Application layer" as App
package "Domain layer" as Domain
package "Persistence adapter" as Storage
UI ..> App : calls
App ..> Domain : uses model
Storage ..> Domain : implements domain contract
@enduml
```

Derive dependency directions from source rather than automatically adding textbook layers. Preserve and explain cyclic dependencies; moving nodes does not remove the cycle.

Official syntax: [Use case](https://plantuml.com/use-case-diagram), [Object](https://plantuml.com/object-diagram), [Package/class organization](https://plantuml.com/class-diagram).
