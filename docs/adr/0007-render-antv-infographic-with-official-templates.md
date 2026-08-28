# ADR 0007: Render AntV Infographic with official templates

## Status

Accepted

## Decision

Fuxian recognizes only the canonical `infographic` fenced block and renders it with the pinned official `@antv/infographic` runtime. Rendering runs in a terminable Web Worker with at most two concurrent tasks. The Worker uses the official browser `Infographic` and `exportToSVG` APIs, with LinkeDOM supplying an offline DOM, and blocks every real network request.

The first release accepts exact built-in template and theme names, bounded data, and a small safe theme-field allowlist. It rejects illustrations, arbitrary attributes, remote and inline resources, custom designs, animated templates, interactive templates, and word clouds. Diagram optimization never changes Infographic source or output.

AntV uses `foreignObject > span` for its primary text. Fuxian therefore applies an Infographic-specific sanitizer that preserves only that exact single-span structure, plain text, geometry attributes, and reviewed layout styles. Other embedded HTML and all external references remain forbidden. Screen, focused view, copying, and PDF export reuse the same sanitized SVG snapshot.

## Consequences

Official template geometry, wrapping, and selectable text are retained more faithfully than converting labels to SVG `text`. Supporting illustrations, custom templates, arbitrary theme fields, or remote icon search requires a separate security and licensing review. Package upgrades require rerunning official-example visual comparisons because the dependency remains pre-1.0.
