---
name: fuxian-diagram-authoring
description: Choose and author diagram, data-visualization, or infographic fenced blocks that Fuxian can render and export reliably.
metadata:
  fuxian-version: '>=0.1.0'
  version: '1.0.0'
---

# Fuxian Diagram Authoring

Create a finished-document visual with the simplest supported engine that matches the reader's intent.

1. Read [capabilities.md](references/capabilities.md) before authoring so the output matches a released Fuxian capability.
2. When the user has not named an engine, read [selection-guide.md](references/selection-guide.md) and choose from the information shape, audience, and maintenance needs. Ask one question only when its answer changes the engine.
3. Read [fence-syntax.md](references/fence-syntax.md) for the chosen engine, then emit a standard Markdown fenced block using a supported info string.
4. Check that the source is complete, readable, and within that engine's Fuxian resource boundary. The block is complete when its syntax and inputs match the reference without relying on an unsupported fence or external data.

Honor an explicitly requested supported engine. When the requested engine is unsupported, state that limitation and use the closest supported alternative only when it preserves the user's meaning.

Keep author styling that carries intent. Prefer maintainable source over ornamental complexity. PlantUML may send the full block to the configured server; do not place secrets in it. Vega-Lite uses inline data. Infographic resources must use Fuxian's reviewed names and static behavior.
