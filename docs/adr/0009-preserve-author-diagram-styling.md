# ADR 0009: Preserve author diagram styling

## Status

Accepted

## Decision

Fuxian does not provide a diagram-optimization preference and does not rewrite Mermaid or PlantUML source to impose application fonts, colors, backgrounds, line styles, or whitespace. Mermaid uses its normal source and default rendering configuration; PlantUML source is sent unchanged to the configured server.

Application appearance settings style only the application shell and finished-document theme. They do not trigger diagram recompilation. Vega-Lite and AntV Infographic continue to preserve their accepted author input under their format-specific security policies.

## Consequences

Diagram output remains predictable across reading, copying, focused viewing, and PDF export. Authors who need a specific appearance must express it in the source format. Fuxian no longer stores, migrates, exposes, or applies a diagram-optimization setting.
