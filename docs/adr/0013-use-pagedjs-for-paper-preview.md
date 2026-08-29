# ADR 0013: Use Paged.js for paper preview

## Status

Accepted

## Decision

Fuxian uses pinned MIT-licensed Paged.js to turn a settled finished-document revision into explicit A4 page DOM. Paper preview runs in a dedicated trusted renderer realm because Paged.js depends on its realm-global `window` and `document`; it is not added to `markdown-renderer`, `document-theme`, or the untrusted continuous preview iframe.

The application starts in continuous mode. Paper mode is transient and always uses A4 portrait with `18 mm` block and `16 mm` inline margins. It automatically fits those fixed pages to the available reading width; this screen-only scaling does not change pagination. Existing A4 document width remains a continuous-layout preference.

Pagination waits for fonts, images, formulas, and diagram snapshots. Results are revision-scoped: obsolete work is discarded and the last successful pages remain visible while a replacement is prepared. Before Paged.js runs, long Markdown tables are split into bounded row groups with repeated headers. A row that cannot fit the page area is converted to a labelled, content-preserving block fallback. Diagrams and images scale proportionally within the printable area; UI controls are overlays and excluded from print layout.

Screen paper preview and PDF export call the same pagination module and paged-media CSS. Electron prints the completed page DOM with CSS page size enabled, A4 selected, zero Electron margins, and backgrounds preserved. End-to-end tests require screen page count to equal PDF page count and verify terminal content and representative visuals.

## Consequences

Paper pages remain selectable DOM and can retain heading navigation, find, links, and rendered-visual actions. Re-pagination is whole-document work rather than an incremental mutation, so large documents need explicit readiness, timeout, and stale-revision handling.

Chromium print layout cannot expose page boxes to screen JavaScript. Native multi-column produces anonymous horizontal fragments, while Vivliostyle Core is AGPL-3.0 and is not embedded in this MIT project. The validated throwaway prototype remains on `codex/issue-29-paper-prototype` at commit `152e7ce`; implementation research is recorded in `docs/research/paper-preview-pagination.md`.
