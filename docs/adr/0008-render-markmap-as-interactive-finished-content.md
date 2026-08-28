# ADR 0008: Render Markmap as interactive finished content

## Status

Superseded by ADR 0010

## Decision

Fuxian recognizes only the canonical `markmap` fenced block. A block containing an inner fenced code block must use a longer outer fence, such as four backticks around content that contains three-backtick fences. It uses pinned `markmap-lib/no-plugins` in at most two terminable ES module Workers and renders the resulting bounded node tree with pinned `markmap-view` inside the finished document.

The first release accepts Markdown headings, lists, basic inline formatting, safe HTTP(S) links, and official fold comments. It rejects frontmatter options, plugins, images, remote assets, arbitrary HTML attributes, and injected scripts or styles. Node HTML is sanitized before `markmap-view` writes it to the DOM; the live structure and export snapshot then pass a Markmap-specific structural sanitizer that preserves only reviewed `foreignObject > div > div` content.

The inline view has a stable responsive height and retains a live Markmap instance for folding, drag panning, explicit zoom, and fit controls. Normal wheel input continues scrolling the finished document. Instances are destroyed on retry, revision replacement, or document teardown.

Copy, focused view, and PDF use a sanitized canonical SVG captured from the fully expanded natural layout. PDF never inherits the reader's temporary fold, pan, or zoom state and never reruns the Markdown transformation.

## Consequences

Markmap remains a quick Markdown thought-organizing format, distinct from AntV Infographic mind maps. Supporting frontmatter options, assets, images, plugins, or richer HTML requires a separate security and determinism review. Package upgrades require rerunning sanitizer, keyboard, resize, bundle, and PDF consistency tests because all Markmap packages remain pre-1.0.
