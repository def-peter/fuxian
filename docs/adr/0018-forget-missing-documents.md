# ADR 0018: Forget missing documents without discarding drafts

## Status

Accepted

## Decision

Fuxian removes a Markdown document from both the open-document session and recent history when the operating system confirms that its path no longer exists. This applies during session restoration, when reopening a recent document, and after the stable file watcher reports a deletion or rename. Fuxian does not infer the file's new path; a renamed or moved document must be opened again.

Only missing-path errors (`ENOENT` and `ENOTDIR`) trigger automatic removal. Unsupported extensions, permission failures, and other temporary read errors remain visible and recoverable rather than being mistaken for deletion. If the active source editor contains unsaved work, the document and its recovery draft remain until the reader explicitly resolves that local work.

## Consequences

- Stale filenames cannot remain in `正在查看` or `最近查看` and repeatedly fail to open.
- Removing the active item selects the next available document; removing the last item returns to the start view.
- Rename tracking is intentionally out of scope because filesystem events do not provide a dependable cross-platform identity.
- ADR 0002's restorable session contains only paths that still exist, except where ADR 0015 requires preserving local edits.
