# ADR 0017: Separate source authority from finished revisions

## Status

Accepted

## Decision

An open document tracks two related but independent revisions: the latest source document read from or explicitly written to disk, and the last finished-document revision accepted for reading. Source editing always starts from the latest source document. Reading, PDF export, headings, and rendered-visual inspection continue to use the finished revision currently visible.

An explicit local save is authoritative immediately. Fuxian presents that saved revision and reports diagram or media failures inside the affected content block; it does not route a local save through the external-revision rollback policy.

An external revision remains staged until its render tasks and resources settle. On failure, Fuxian keeps the last successful finished revision visible and reports that the newer disk revision failed, while retaining the newer source for inspection and correction. A dirty edit buffer still creates an external conflict before either revision is adopted.

This refines ADR 0003 and ADR 0015 without changing their automatic file-watching or conflict-protection decisions.

## Consequences

- Session state must not use one object as both source authority and render-success cache.
- A failed external render may leave the source revision newer than the visible finished revision.
- Diagram source and PDF export describe the visible finished revision; full source editing describes the latest disk revision.
- Tests must cover local-save failures, external-revision rollback, and returning from source mode to retained finished-document controls.
