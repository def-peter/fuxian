# Content and layout validation

## Choose validation by impact

Validate what the change can affect. Reuse known tools and previous successful checks of unchanged content; a small edit does not restart engine selection or full-document QA.

| Change | Appropriate scope |
| --- | --- |
| Caption or adjacent prose only | Check wording and consistency with the diagram. No diagram rendering is needed when its source is unchanged. |
| Title or display label in an existing diagram | Check the source diff and syntax, preserving data and mappings. Render and inspect the affected chart at its chosen size when the text change could affect wrapping, clipping, or association. |
| Values, transforms, scales, relationships, or category identifiers | Check affected semantics and dependent references, then render and inspect affected diagrams. Renaming a data key is not merely a display-label edit. |
| New diagram or substantial redesign | Apply the content, source, rendering, and visual checks below. |

Run checks explicitly required by the user or repository. Otherwise, do not expand a local edit into whole-report validation, new assertion scripts, additional viewport sizes, or unrelated layout cleanup. Update an existing assertion if the requested change invalidates its intended expectation; do not rewrite unrelated assertions merely to make a broad script pass. Identify unrelated failures separately.

If inspection reveals a concrete readability defect in the affected chart, fix that defect and recheck it. Stop once the requested change and affected readability pass. Report which checks ran; do not describe skipped checks as passed or imply a whole-document audit.

## Content checks

Compare each diagram with its content anchor: the main question is answered; key entities, conditions, and exceptions are present; edge directions and cardinalities are correct; values, units, and time windows match the source; and assumptions and examples are identified. The caption and adjacent prose explain the same subject.

## Source and rendering

Use an available renderer compatible with the chosen engine. Inspect in a specific host such as Fuxian when the user requests host-specific verification or the reported problem depends on that host. Successful standalone rendering does not establish host integration, but ordinary diagram authoring does not require repeating the same check in additional applications.

| Engine      | Meaningful checks                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PlantUML    | Render complete source using the available local CLI or configured service; check for an error diagram and inspect target-language fonts, theme, and layout. HTTP success or an SVG file does not prove valid source |
| Mermaid     | Check with the target version's parser, then render SVG in Fuxian or an available Mermaid CLI; successful parsing does not prove labels are unclipped                                                                |
| Vega-Lite   | Parse JSON, validate against the matching schema, compile, then execute the dataflow to generate SVG; compilation alone can miss resource, expression, or sizing failures                                            |
| Infographic | Check `parseSyntax` errors/warnings, template names, and fields, then render; verify all items and optional icons are present                                                                                        |

Respect content and environment constraints when sending source to services; use local rendering for offline requirements. Reuse existing tools rather than requiring a global toolchain for ordinary diagram authoring.

## Visual inspection

Inspect the chosen layout after rendering rather than inferring it from source. Choose dimensions and orientation for the content, readable labels, and balanced spacing. By default, inspect one useful rendered view; do not add A4, narrow-column, or multiple-viewport passes merely because the Markdown can be opened in Fuxian.

- **Chosen layout:** Titles, target-language text, and symbols are complete; text is neither overlapping nor clipped; arrows and legends are distinguishable; spacing and font sizes make the diagram readable.
- **Statistical chart reading:** Check the concise chart title, directly readable values, and authored tooltips against the [Vega-Lite defaults](vega-lite.md#chart-reading-defaults). Verify number formats and units, including percentages and zeros. Inspect value-label placement; when tooltips are added or changed, check their rendered values and test hover on a representative mark and label if an interactive preview is available. Report source-only verification honestly when it is not.
- **Explicit size constraints:** When the user requires a fixed width, narrow column, or multiple sizes, inspect those requested dimensions. Adapt the diagram only as needed to preserve readability and facts.
- **Process connectors:** Follow branches, merges, and loops to verify their destinations. For PlantUML activity diagrams, apply the [connector clarity checks](plantuml/activity-swimlanes.md#connector-clarity-checks) and assess whether intermediate arrowheads introduce ambiguity.
- **Edge labels:** Each label is visibly adjacent to its own connector and can be associated with it without guessing. Inspect long curves, fan-in/fan-out, bypass links, and neighboring edges: readable text floating between two lines still fails this check. For structural PlantUML diagrams, use the [edge-label correction sequence](plantuml/layout-troubleshooting.md#edge-labels-detached-from-their-connectors).
- **Color meaning:** Custom colors used for categories, states, stages, or emphasis have a visible explanation. Read that explanation against every colored node/edge; labels, shapes, or grouping preserve the meaning without color. Remove arbitrary extra colors when they add no information. Uniform theme styling does not require a legend for every decorative color; chart legends and direct labels may already supply the mapping.
- **Prose integration:** Place the diagram near its explanation with appropriate whitespace and its caption attached.
- **Paper preview/PDF:** Only when the user requests printing, PDF, or a specific paper format, inspect the requested pagination, page boundaries, caption placement, and static-frame meaning. Do not assume A4 for an unspecified page format.

For an observed defect, correct content organization, labels, or direction/grouping/template as appropriate; split only when complexity or an explicit delivery constraint warrants it. Rerender the affected diagram after changes. Stop when content and readability checks pass. Do not repeat rendering or search for more layout variants solely to satisfy an unrequested paper mode or viewport.

## Verification inside the Fuxian repository

- `packages/markdown-renderer/src/skill-contract.test.ts` checks that complete examples throughout this skill are recognized as the corresponding render tasks; it is not an engine-rendering or layout test.
- Reuse the hidden E2E environment shown in the relevant diagram and PDF tests under `tests/electron/`. Keep it hidden by default; use the repository's secondary mode when visual debugging is needed.
- Wait for diagram tasks to succeed and for document readiness. Failed tasks may have finished waiting without producing correct diagrams. PDF tests must wait for `export-ready` before checking exported output.
- Outside the repository, use an available Fuxian app or matching renderer. These repository paths are not required dependencies of an installed skill.

## Completion criteria

Report **source checked**, **actually rendered**, and **inspected and passed at the target layout** separately and truthfully. Call verification complete only within the requested delivery scope. If rendering or screenshot tools are unavailable, deliver editable source and list unverified checks. Do not claim layout success or discard completed work because verification is unavailable.
