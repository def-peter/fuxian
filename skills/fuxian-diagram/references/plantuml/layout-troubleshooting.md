# PlantUML layout and diagnosis

Preserve semantics before adjusting layout. `mars` is the default theme, not a layout engine; a theme cannot fix excessive nodes, long text, or incorrect relationships.

| Symptom                                                             | Check first                                             | Correction                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SVG contains a syntax error                                         | Error text, line, and start marker                      | Correct the declaration/type; HTTP 200 does not establish successful rendering                           |
| Activity syntax stops working                                       | Mixed legacy nodes or direction directives              | Use modern activity syntax consistently; restore branches incrementally                                  |
| Class/component diagram is too wide                                 | Long labels, many peers, long-distance edges            | Short aliases, semantic groups, vertical layout, or separate levels                                      |
| Sequence is too wide                                                | Participant count and message length                    | Short display names, message wrapping, or separate transactions                                          |
| Note expands the whole diagram                                      | Prose copied into a note                                | Keep key constraints in the diagram and details nearby                                                   |
| Missing Chinese glyphs                                              | Fonts on the actual rendering service                   | Choose a server-available font; local font installation cannot fix a remote service                      |
| Arrows cross labels                                                 | Layout constraints or orthogonal edges with labels      | Reduce forced directions/hidden edges first; try default routing rather than applying ortho mechanically |
| Label floats far from its edge or appears to belong to another edge | Long curves, forced ranks, fan-in/fan-out, bypass links | Apply the edge-label correction sequence below; readability alone is insufficient                        |
| Colored nodes or arrows have no explained meaning                   | Custom fills/strokes and their intended grouping        | Keep theme defaults where no distinction is needed; explain meaningful overrides visibly                 |
| Theme/include fails                                                 | Service version and library availability                | Verify target support, retain the requested theme requirement, and explain the specific limitation       |

## Available layout techniques

Structural diagrams may use `left to right direction`; the default vertical direction often suits narrow columns better. `nodesep` and `ranksep` tune node and rank spacing in structural diagrams. Inspect actual rendering after changes rather than imposing fixed values on every diagram.

Sequence diagrams can use `hide footbox` to remove repeated bottom participants, `\n` for long messages, and `== Stage ==` for sections. For activity diagrams, prioritize branch organization and lanes rather than structural-diagram layout parameters.

Use hidden edges only for local alignment after semantics are established. Avoid overconstraining layout with hidden edges and many manual directions.

## Edge labels detached from their connectors

Structural diagram labels are placed by the layout engine. A valid `source --> target : label` does not guarantee that the label stays close to its rendered edge. `mars` controls styling; it does not guarantee label placement.

1. Trace each labeled edge from its source to its target in the rendered output. A label must be near its own line, distinguishable from neighboring edges, and readable at the delivery width. A long connector can have a valid midpoint label; proximity to the arrowhead is not the requirement.
2. Remove unnecessary hidden edges and directional constraints before adding more. For example, forcing three independent inputs into a vertical chain can create long curved connections to a shared result; allowing the inputs to sit beside one another can shorten those edges. Hidden edges still affect layout even though readers cannot see them.
3. If needed, adjust the overall direction or group placement and shorten visible node/edge text. Preserve full technical identifiers in an adjacent mapping table when moving them out of the diagram. Keep every source, target, bypass path, and relationship meaning intact.
4. Try `skinparam linetype polyline` only as a diagram-specific experiment, then inspect again. It is not a universal fix. Avoid applying `linetype ortho` as a blanket remedy: the official layout documentation notes edge-label positioning problems with it. Alternate layout engines also require target-runtime and visual checks.
5. If a dense view still fails, split overview and detail views or use visibly attached notes. Do not invent intermediate business nodes, pad labels with spaces, or move text inside generated SVG as a substitute for correcting the editable source. Do not use endpoint/cardinality label controls as if they reposition every ordinary edge label.

Rerender after each structural change and repeat the association check at normal and narrower document widths. An unresolved detached label is a layout failure to report, even when compilation succeeds.

## Custom colors need visible meaning

Start with mars or the user's requested theme. For a new diagram, introduce only the custom distinctions that help answer the reader's question. A decorative accent can stay uniform; coloring successive nodes differently implies distinctions that need explaining.

When custom fills/strokes encode categories, stages, status, or emphasis, include a compact `legend`, direct labels, or an explanation next to the diagram. Preserve an existing or requested palette and explain its documented mapping; if its meaning is unknown, do not invent business meaning for it. Keep node names, edge labels, shapes, or group titles sufficient to understand the graph without color. A uniformly colored arrow can simply be identified as the direction of data flow when a legend is otherwise needed.

See the [dataflow example](architecture-deployment.md#dataflow-with-labeled-inputs-and-explained-colors) for independent inputs and an explicit color legend.

Official references: [layout engines and options](https://plantuml.com/layout-engines), [legends](https://plantuml.com/commons).

## Correction loop

Preserve the original error → Reproduce with the same service → Isolate the relevant declaration/fragment → Edit complete source → Rerender → Inspect at normal document width. Report network and syntax failures separately; do not silently switch a requested engine to avoid a network failure.

See [validation.md](../validation.md) for shared artifact checks.
