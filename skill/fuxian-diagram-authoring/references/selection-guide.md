# Visual Selection Guide

Choose from the shape of the information, not from visual novelty.

| Information shape                                                   | Default          | Choose another engine when                                     |
| ------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- |
| Flow, state, sequence, journey, simple hierarchy or relationship    | Mermaid          | Strict UML notation or PlantUML ecosystem features are central |
| UML, component/deployment architecture, complex sequence            | PlantUML         | A common lightweight diagram is clearer in Mermaid             |
| Quantitative comparison, trend, distribution, correlation           | Vega-Lite        | The goal is a narrative summary rather than analytical reading |
| Narrative facts, milestones, comparisons, structured visual summary | AntV Infographic | Exact axes, scales, or data encodings matter; use Vega-Lite    |

## Close Calls

- Mermaid vs PlantUML: use Mermaid for concise, broadly editable diagrams; use PlantUML for formal UML, dense technical models, or existing PlantUML source.
- Mermaid mindmap vs Markmap: Fuxian does not render Markmap fences. Use Mermaid `mindmap` for a source-authored quick hierarchy, or ordinary headings when the user only needs Fuxian's on-demand article structure map.
- Vega-Lite vs Infographic: use Vega-Lite when values must be compared against a scale; use Infographic when hierarchy and explanatory copy are the main message.
- Architecture vs unsupported D2: use Mermaid architecture/flowchart or PlantUML component/deployment syntax according to formality and density.

Use one visual when it carries the message. Split only when a single diagram would become harder to scan or maintain.
