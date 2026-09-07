# ADR 0024: Preserve official AntV Infographic capabilities

## Status

Accepted

## Decision

Fuxian passes every capability represented by the pinned `@antv/infographic` syntax to the official
runtime instead of maintaining a product-level feature blacklist. This includes all exact built-in
templates, animated templates, custom `design`, complete theme configuration, resource objects, data
attributes, and explicit width and height. The finished document remains non-editable; the library's
editor is a separate authoring surface rather than part of Infographic rendering.

Security is enforced at system boundaries instead of by removing official visual behavior. Rendering
runs in a bounded, terminable Worker. Network requests remain credential-free, size-limited, and
restricted to reviewed resource services. Unavailable or untrusted optional resources degrade without
making the entire Infographic unreadable. DOMPurify removes executable markup and unsafe references
after rendering while preserving the official single-span text structure, benign author styling, and
the pinned runtime's reviewed `stroke-dashoffset` animation.

## Consequences

Official static and animated visuals, themes, custom compositions, and sizing reach the same runtime
used by AntV. Screen, focused view, SVG copy, paper preview, and PDF continue to reuse one sanitized
SVG snapshot; animated SVG remains live on screen and is naturally captured as a static frame by PDF.
Package upgrades require an audit of generated HTML, CSS, animation elements, resource endpoints, and
representative official templates before the pin changes.
