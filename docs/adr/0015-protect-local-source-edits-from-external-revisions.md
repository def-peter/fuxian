# Protect local source edits from external revisions

Fuxian adds a source-only editing mode while remaining a finished-document reader. Clean documents continue to accept stable external revisions automatically, but a dirty edit buffer suspends automatic replacement and turns a later disk revision into an explicit external conflict. Saving is user-initiated, verifies the source baseline before an atomic write, and never overwrites a conflicting disk revision silently. Unsaved buffers are retained as recovery drafts so document switching, closing, quitting, updating, or crashing cannot discard local work without a reader decision. This supersedes ADR-0003's assumption that every open document is read-only.

## Consequences

- Reading and source editing are mutually exclusive; Fuxian does not add split or live preview.
- Reading position and source selection are independent restorable states.
- A recovery draft is not autosave: only an explicit save updates the source document.
- Closing, switching, quitting, and installing an update must settle dirty buffers before proceeding.
