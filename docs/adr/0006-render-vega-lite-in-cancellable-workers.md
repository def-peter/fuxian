# ADR 0006: Render Vega-Lite in cancellable workers

## Status

Accepted

## Decision

Fuxian treats a canonical `vega-lite` fenced block as a visualization block. It parses JSON, validates the bundled Vega-Lite schema and Fuxian's stricter inline-data policy, compiles the specification, and renders selectable SVG locally in a Web Worker. At most two Vega-Lite workers run concurrently. Cancelling or timing out a task terminates its worker, so obsolete or hostile CPU work cannot continue in the renderer.

The runtime uses Vega's AST parser with `vega-interpreter`; it never enables `unsafe-eval`. A fail-closed loader rejects every external resource. The MVP rejects interactive parameters, external or named data, image marks, links, nondeterministic expressions, and transforms with unbounded or random expansion. The final SVG passes through the same structural sanitizer used by other rendered visual blocks.

The finished document and PDF export reuse the same sanitized SVG snapshot. Vega-Lite is not rerun in the export window, and its author-provided specification is not rewritten by application appearance settings.

## Consequences

Vega dependencies and schema load only after the first matching block, outside the main renderer thread. Worker termination provides a real cancellation boundary at the cost of loading a fresh worker for each active task. Supporting YAML, remote data, interactive charts, or a broader transform set requires a separate security and determinism review.
