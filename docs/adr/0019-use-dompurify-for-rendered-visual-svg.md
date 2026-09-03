# ADR 0019: Use DOMPurify for rendered visual SVG

## Status

Accepted

## Decision

Fuxian uses a pinned DOMPurify release as the common security baseline for SVG produced by Mermaid,
PlantUML, Vega-Lite, and AntV Infographic. It no longer maintains a handwritten blacklist that
removes SVG elements, attributes, or complete style sheets with selectors and regular expressions.

The application retains only product-specific policy: accept exactly one bounded SVG, remove diagram
links while preserving their contents, reject external `href` values, and permit AntV's reviewed
`foreignObject > span` text structure. Standard internal SVG reuse through `use` and fragment
references remains available. The finished-document content security policy continues to prevent
rendered visuals from loading unapproved network resources.

## Consequences

Generated CSS and renderer-authored geometry are preserved, including Mermaid flowchart strokes and
AntV symbol reuse. Browser SVG parsing, namespace handling, dangerous elements, event attributes, and
unsafe URLs are delegated to a maintained security library. DOMPurify upgrades require sanitizer,
Mermaid, PlantUML, Vega-Lite, Infographic, copy, and PDF regression tests.
