# ADR 0007: Render AntV Infographic with official templates

## Status

Accepted

## Decision

Fuxian recognizes only the canonical `infographic` fenced block and renders it with the pinned official `@antv/infographic` runtime. Rendering runs in a terminable Web Worker with at most two concurrent tasks. The Worker uses the official browser `Infographic` and `exportToSVG` APIs, with LinkeDOM supplying the DOM. Local Lucide and MDI resources are preferred. Resource search may access only the exact endpoint used by the official runtime, and returned SVG may load only from the reviewed Alibaba CDN path. Requests omit credentials and referrers, reject redirects, and enforce time, type, and size limits. Every downloaded SVG is sanitized before AntV consumes it; all other network access remains blocked.

Fuxian accepts exact built-in template and theme names, bounded data, and a small safe theme-field allowlist. Static word-cloud, illustration, and `sequence-interaction` templates are supported; the latter describe sequence layouts and do not enable the official editor. It rejects arbitrary resource URLs, resource objects, arbitrary attributes, custom designs, and animated templates. Animated templates remain disabled because the official exporter preserves indefinitely running SMIL rather than producing a deterministic PDF frame. Fuxian preserves the accepted Infographic source and output styling.

AntV uses `foreignObject > span` for its primary text. Fuxian therefore applies an Infographic-specific sanitizer that preserves only that exact single-span structure, plain text, geometry attributes, and reviewed layout styles. Other embedded HTML and all external references remain forbidden. Screen, focused view, copying, and PDF export reuse the same sanitized SVG snapshot.

## Consequences

Official template geometry, wrapping, illustrations, and selectable text are retained more faithfully than converting labels to SVG `text`. Screen, full-screen view, SVG copying, and PDF export use the same sanitized snapshot, so export never reloads online resources. Supporting animation, custom templates, arbitrary theme fields, additional domains, or arbitrary URLs requires a separate security review. Package upgrades require rerunning official-example visual comparisons because the dependency remains pre-1.0.
