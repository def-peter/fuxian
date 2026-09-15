# Deriving diagrams from code and configuration

Use traceable evidence to answer questions about an actual system, rather than drawing every file. When designing a new system, distinguish recommendations from the current implementation.

## Evidence mapping

| Evidence                                                                | Supports                                                     | Does not establish                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Routes, event entry points, and call implementations                    | Request sequences, input checks, and error exits             | Every dependency being called in this request           |
| Imports, interfaces, and module definitions                             | Type and module dependencies                                 | Separate processes, network calls, or actual deployment |
| State assignments and transition conditions                             | Lifecycles and guards                                        | Every legal transition inferred from names              |
| Schemas, migrations, and constraints                                    | Entities, primary/foreign keys, cardinality, and nullability | Uniqueness inferred only from a field suffix            |
| Queue publishers/subscribers, acknowledgements, and retry configuration | Async messages, consumption boundaries, and redelivery       | Exactly-once execution or inherent idempotency          |
| Compose, Kubernetes, and IaC                                            | Instances, networks, storage, and deployment boundaries      | Configuration already deployed to production            |
| Existing tests and fixtures                                             | Expected behavior in specific scenarios                      | The same guarantees in untested scenarios               |

## Trace the relevant path

Start at the entry point relevant to the user's question. Follow the main call chain through branches, data structures, and configuration. Keep a file or passage reference for each node and important edge. Include input rejection, unavailable resources, and defined exception handling as well as the success path.

For “what happens when export fails,” inspect the export entry point, readiness checks, render-failure handling, and returned status, rather than turning the entire application directory into an architecture tree.

## Select the view

- Who calls whom and when results return: sequence diagram.
- Conditions determining the next step: activity diagram.
- When an object enters a new state: state diagram.
- Module responsibilities and contracts: component, class, or package diagram.
- Runtime locations and communication: deployment diagram.

The same source can support several views. Deliver only those needed to answer the current question. Framework conventions and templates are reading aids, not facts to copy.

## Delivery checks

Verify each edge's direction and meaning. Synchronous/asynchronous behavior, transaction boundaries, and failure conditions need evidence; identify unknowns. Simplification may combine internal details but must preserve exception paths that change the reader's understanding. Include key source locations in nearby prose so the diagram can evolve with the implementation.
