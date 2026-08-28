# ADR 0010: Derive article structure maps from the content outline

## Status

Accepted

## Decision

Fuxian does not recognize `markmap` as a rendered Markdown fence. Such fences remain ordinary code blocks. Instead, the content-outline header exposes an article-structure-map action for documents that contain headings.

The application converts the active document's already extracted, plain-text heading hierarchy directly into a bounded Markmap node tree. It escapes every heading before rendering and lazily loads pinned `markmap-view` only when the dialog opens. No second Markdown parser, frontmatter, plugin, remote asset, author option, or Worker is involved.

The dialog supports node folding, drag panning, explicit zoom, and fit-to-window controls. It is application UI derived from the current document session, not finished-document content; it is excluded from source inspection, rendered-visual snapshots, copying, PDF export, and render readiness.

## Consequences

Authors write ordinary headings and never need Markmap syntax or nested fences. The structure map always matches the content outline and updates with external revisions. Documents without headings disable the action. `markmap-view` and `markmap-common` remain runtime dependencies, while `markmap-lib` and the transform Worker are removed.
