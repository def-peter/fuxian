---
name: fuxian-diagram
description: Create or improve diagrams for Fuxian Markdown. When users ask for diagrams, visualizations, explanations of complex content, or document illustrations, identify the content to explain, choose PlantUML, Mermaid, Vega-Lite, or AntV Infographic, generate source, and validate layout. Users need no prior knowledge of these engines.
---

# Fuxian Diagram

From [Fuxian](https://github.com/def-peter/fuxian), a Markdown desktop reader with diagram rendering and PDF export.

Turn the reader's key questions into readable, deliverable diagrams. Default to Markdown fences that Fuxian can render. Preserve the user's terminology.

**Language:** These instructions and references are written in English; output is not restricted to English. Support Chinese and English requests. Follow an explicitly requested output language first, otherwise the target document's language when editing a document, or the user's request language for other tasks. Use that language for titles, labels, legends, and explanations; translate example copy as needed. Preserve syntax keywords, identifiers, data fields, and text the user asks to retain. Produce both language versions only when requested, then recheck text length, fonts, and layout.

## 1. Anchor the content

Distinguish explicit choices of **content, diagram type, engine, style, and delivery location**. For example, “sequence diagram” specifies a type, not Mermaid; “use Mermaid” specifies an engine, not the subject.

- When content is specified, diagram that content and preserve its scope.
- For “visualize this document,” read the prose, data, or relevant source code. Identify core conclusions, interactions across roles, branches and exceptions, state changes, confusing concepts, and data comparisons. Select content by explanatory value rather than illustrating every paragraph.
- Establish an anchor for each candidate diagram: **source passage or data → reader's question → facts or relationships that must survive → placement**. Anchor first, then select the engine.
- If the available content is sufficient, briefly state the intended focus and proceed. Ask only when the source, essential data, or meaning-changing facts are missing. Make engine and template choices for users unfamiliar with them.

For whole documents, unclear scope, or multiple diagrams, read [content-planning.md](references/content-planning.md). For diagrams derived from actual code or configuration, read [code-to-diagram.md](references/code-to-diagram.md).

Each diagram answers one main question. Split complex material into overview and detail views; keep simple facts as prose or tables. Mark unknown relationships as unconfirmed and example data as illustrative. Do not present assumptions as established facts.

## 2. Choose the representation

Explicit diagram type, engine, and style take priority. Preserve an existing diagram's format unless the user requests a change. Before automatic selection, read the [diagram-type inventory](references/selection-guide.md#diagram-type-inventory) to identify candidate types and their coverage status. For an explicit engine, read that engine's type inventory directly. Then choose by content:

| Reader's question                                                                                    | Default              | Rationale                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Who interacts, how do steps branch, how do states change, or how do components depend on each other? | **PlantUML**         | Processes, sequences, states, architecture, and UML relationships; default to `!theme mars`                            |
| Is Mermaid explicitly requested or required by the delivery environment?                             | **Mermaid**          | Follow the requested syntax and target platform; prefer PlantUML when both fit equally and no other constraint applies |
| Which is larger, how does it change, how is it distributed, or are variables related?                | **Vega-Lite**        | Accurate values, coordinates, scales, and statistical comparison                                                       |
| Which points, stages, tradeoffs, or levels should readers understand and remember?                   | **AntV Infographic** | Narrative overviews, key points, milestones, and comparison cards organized around copy and information structure      |

PlantUML takes priority only where its use cases overlap with Mermaid. It does not replace Vega-Lite for statistical analysis or Infographic for narrative summaries. See [selection-guide.md](references/selection-guide.md) for boundary cases.

## 3. Author the diagram

Read [capabilities.md](references/capabilities.md) for Fuxian's boundaries, then the selected engine's index and the relevant diagram-type guides. Before authoring, read [validation.md](references/validation.md) and locate available rendering and screenshot tools: inside the repository, inspect root package.json scripts and corresponding tests/electron cases; elsewhere, inspect available apps or engine tools such as `command -v plantuml` or `command -v mmdc`. Reuse the existing environment. If tools are unavailable, complete the source and record outstanding verification.

- [plantuml.md](references/plantuml.md): diagram types, relationship semantics, mars theme, and layout.
- [mermaid.md](references/mermaid.md): declarations, labels, grouping, and syntax pitfalls.
- [vega-lite.md](references/vega-lite.md): data, marks, encodings, scales, and snapshot behavior.
- [infographic.md](references/infographic.md): template selection, field mapping, copy, and styling.

The detailed guides provide complete adaptable examples, relationship or data semantics, layout techniques, and troubleshooting. See [fence-syntax.md](references/fence-syntax.md) for minimal complete fences. Place diagrams near the corresponding content with a brief caption and any necessary metric definitions or relationship notes. Retain editable source for standalone diagrams; generate image or PDF files when requested.

Use theme defaults as the starting point. Add custom colors for a stated reading purpose; when colors distinguish categories, states, stages, or emphasis, make their meaning visible in a legend, direct labels, or adjacent explanation. Preserve explicit palettes and existing mappings. Before delivery, check both [label-to-edge association and color meaning](references/validation.md#visual-inspection), not only whether text is present.

## 4. Validate and deliver

Let the content determine a natural, clear, visually balanced layout: horizontal, vertical, wide, or tall as appropriate. A4 paper mode, narrow columns, and multiple viewport sizes are not default design targets. Adapt to page size, printing, PDF, or fixed dimensions only when the user explicitly requests that delivery constraint.

Follow [validation.md](references/validation.md): source checks → actual rendering → visual inspection of the chosen layout. Parsing or compilation completes only the first step. Compare the result against each content anchor: **decision conditions, edge labels, cardinalities, key values, option names, and dates** must remain fully readable. Text present in source is not proof that it appears in the diagram. Check actual pagination separately when PDF is required.

| Trigger                                                  | Correction                                                                                                                                                                                                                    | If unresolved                                                                                           |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Overlapping labels, distorted line breaks, or tiny text  | In flowcharts, keep conditions in decision nodes and use short edge labels; preserve each other diagram type's condition placement. Adjust branches, loops, direction, or card size; split if needed, then render and inspect | Keep source containing all facts and list the specific layout checks that failed                        |
| Syntax error, blank diagram, or missing template content | Preserve the original error; check declarations, data, and design types against the engine guide, then reproduce in the same runtime                                                                                          | Stop repeating the same failure without new evidence; deliver a minimal reproduction and completed work |
| Unavailable service, font, or resource                   | Distinguish environment failures from source errors; check existing configuration and available local paths; preserve textual meaning when optional resources are missing                                                     | Identify the blocked step; do not silently replace an explicitly requested engine or type               |

After correcting an observed defect, recheck only the affected diagrams. Stop once the content is correct and the chosen layout is clear; do not generate additional layout variants or width checks without a concrete problem or explicit requirement. An automatically selected template may be replaced within the same engine by a verified template that preserves all key facts. Ask only about tradeoffs that change an explicit requirement or factual meaning.

Briefly explain the content and diagram choice, provide the artifact or Markdown path, and report **source checks, actual rendering, and layout inspection** separately. Retain screenshot or artifact locations when visual inspection was performed. Without rendering tools, state “Not yet rendered or visually verified.” List any failures explicitly rather than reporting an overall pass.

When maintaining this skill, upgrading engines, or investigating known problems, read [sources.md](references/sources.md).
