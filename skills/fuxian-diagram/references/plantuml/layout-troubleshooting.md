# PlantUML layout and diagnosis

Preserve semantics before adjusting layout. `mars` is the default theme, not a layout engine; a theme cannot fix excessive nodes, long text, or incorrect relationships.

| Symptom                             | Check first                                        | Correction                                                                                               |
| ----------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| SVG contains a syntax error         | Error text, line, and start marker                 | Correct the declaration/type; HTTP 200 does not establish successful rendering                           |
| Activity syntax stops working       | Mixed legacy nodes or direction directives         | Use modern activity syntax consistently; restore branches incrementally                                  |
| Class/component diagram is too wide | Long labels, many peers, long-distance edges       | Short aliases, semantic groups, vertical layout, or separate levels                                      |
| Sequence is too wide                | Participant count and message length               | Short display names, message wrapping, or separate transactions                                          |
| Note expands the whole diagram      | Prose copied into a note                           | Keep key constraints in the diagram and details nearby                                                   |
| Missing Chinese glyphs              | Fonts on the actual rendering service              | Choose a server-available font; local font installation cannot fix a remote service                      |
| Arrows cross labels                 | Layout constraints or orthogonal edges with labels | Reduce forced directions/hidden edges first; try default routing rather than applying ortho mechanically |
| Theme/include fails                 | Service version and library availability           | Verify target support, retain the requested theme requirement, and explain the specific limitation       |

## Available layout techniques

Structural diagrams may use `left to right direction`; the default vertical direction often suits narrow columns better. `nodesep` and `ranksep` tune node and rank spacing in structural diagrams. Inspect actual rendering after changes rather than imposing fixed values on every diagram.

Sequence diagrams can use `hide footbox` to remove repeated bottom participants, `\n` for long messages, and `== Stage ==` for sections. For activity diagrams, prioritize branch organization and lanes rather than structural-diagram layout parameters.

Use hidden edges only for local alignment after semantics are established. Avoid overconstraining layout with hidden edges and many manual directions. If colors denote roles or states, explain them in text; label error paths as well as coloring them.

## Correction loop

Preserve the original error → Reproduce with the same service → Isolate the relevant declaration/fragment → Edit complete source → Rerender → Inspect at normal document width. Report network and syntax failures separately; do not silently switch a requested engine to avoid a network failure.

See [validation.md](../validation.md) for shared artifact checks.
