# Official sources and maintenance

When maintaining the skill, upgrading an engine, or diagnosing known issues, consult the relevant engine's official documentation, repository Issues, and release history. Use local guides as needed for ordinary authoring; consult official sources for uncovered syntax, version differences, or rendering problems.

## Engine entry points

| Engine           | Official documentation                                            | Official Issues                                                    | Release history                                            |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Mermaid          | [Syntax and usage](https://mermaid.ai/open-source/intro/)         | [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid/issues) | [Releases](https://github.com/mermaid-js/mermaid/releases) |
| PlantUML         | [Language reference and diagram types](https://plantuml.com/)     | [plantuml/plantuml](https://github.com/plantuml/plantuml/issues)   | [Releases](https://github.com/plantuml/plantuml/releases)  |
| Vega-Lite        | [Grammar, examples, and API](https://vega.github.io/vega-lite/)   | [vega/vega-lite](https://github.com/vega/vega-lite/issues)         | [Releases](https://github.com/vega/vega-lite/releases)     |
| AntV Infographic | [Syntax, templates, and themes](https://infographic.antv.vision/) | [antvis/Infographic](https://github.com/antvis/Infographic/issues) | [Releases](https://github.com/antvis/Infographic/releases) |

## Applying official material

- **Syntax and semantics:** Check declarations, fields, diagram semantics, and configuration against documentation for the relevant version. The latest website features may not be supported in Fuxian. Verify the actual dependency or PlantUML service version and [capabilities.md](capabilities.md).
- **Known issues:** Search official Issues by engine version, diagram type, original error, or layout symptom. Check minimal reproductions, maintainer conclusions, linked fixes, and the releases containing them. A suggestion or closed issue alone does not prove the target runtime is fixed.
- **Verify fixes:** Reproduce the issue in the target runtime before adopting a workaround. Record applicable versions, triggering conditions, and source links. Recheck after upgrades and remove obsolete workarounds once the fix is effective.
- **Update guides:** Add verified conclusions to the relevant diagram-type guide and update affected examples and capability boundaries. Inspect rendered output for layout changes and actual pagination for PDF changes. Record any unverified steps.

Explicit user choices of diagram type, engine, and style remain authoritative. PlantUML mars and Vega-Lite Ant Design colors are this skill's authoring defaults; they do not change the engines' official semantics or supported features.
