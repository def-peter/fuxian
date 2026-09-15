# Content and layout validation

## Content checks

Compare each diagram with its content anchor: the main question is answered; key entities, conditions, and exceptions are present; edge directions and cardinalities are correct; values, units, and time windows match the source; and assumptions and examples are identified. The caption and adjacent prose explain the same subject.

## Source and rendering

Use the target renderer available in the current environment, preferably inspecting the final Markdown in Fuxian. Standalone renderers help diagnose syntax but do not replace verification of the finished Fuxian document.

| Engine      | Meaningful checks                                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PlantUML    | Render complete source using the available local CLI or configured service; check for an error diagram and inspect target-language fonts, theme, and layout. HTTP success or an SVG file does not prove valid source |
| Mermaid     | Check with the target version's parser, then render SVG in Fuxian or an available Mermaid CLI; successful parsing does not prove labels are unclipped                                                                |
| Vega-Lite   | Parse JSON, validate against the matching schema, compile, then execute the dataflow to generate SVG; compilation alone can miss resource, expression, or sizing failures                                            |
| Infographic | Check `parseSyntax` errors/warnings, template names, and fields, then render; verify all items and optional icons are present                                                                                        |

Respect content and environment constraints when sending source to services; use local rendering for offline requirements. Reuse existing tools rather than requiring a global toolchain for ordinary diagram authoring.

## Visual inspection

Inspect screenshots or exported diagrams after rendering rather than inferring layout from source. Check the intended delivery context:

- **Normal reading width:** Titles, target-language text, and symbols are complete; text is neither overlapping nor clipped; arrows and legends are distinguishable; scaled diagrams remain readable at normal document text sizes.
- **Narrower document width:** Check whether shrinking a wide diagram makes it unreadable or horizontal labels overflow. Prefer direction changes, another template, shorter labels, or splitting the diagram.
- **Process connectors:** Follow branches, merges, and loops to verify their destinations. For PlantUML activity diagrams, apply the [connector clarity checks](plantuml/activity-swimlanes.md#connector-clarity-checks) and assess whether intermediate arrowheads introduce ambiguity.
- **Prose integration:** Place the diagram near its explanation with appropriate whitespace and its caption attached. Understanding should not depend on opening a separate full-screen view.
- **Paper preview/PDF:** When printing or PDF is requested, inspect actual pagination, page boundaries, caption placement, scaling of tall diagrams, and whether a static frame preserves meaning. An A4-width continuous view is not paper preview.

A useful correction order is content organization → label wrapping/shortening → direction/grouping/template → separate overview and detail views. Rerender affected diagrams and inspect the actual delivery layout after changes.

## Verification inside the Fuxian repository

- `packages/markdown-renderer/src/skill-contract.test.ts` checks that complete examples throughout this skill are recognized as the corresponding render tasks; it is not an engine-rendering or layout test.
- Reuse the hidden E2E environment shown in the relevant diagram and PDF tests under `tests/electron/`. Keep it hidden by default; use the repository's secondary mode when visual debugging is needed.
- Wait for diagram tasks to succeed and for document readiness. Failed tasks may have finished waiting without producing correct diagrams. PDF tests must wait for `export-ready` before checking exported output.
- Outside the repository, use an available Fuxian app or matching renderer. These repository paths are not required dependencies of an installed skill.

## Completion criteria

Report **source checked**, **actually rendered**, and **inspected and passed at the target layout** separately and truthfully. Call verification complete only within the requested delivery scope. If rendering or screenshot tools are unavailable, deliver editable source and list unverified checks. Do not claim layout success or discard completed work because verification is unavailable.
