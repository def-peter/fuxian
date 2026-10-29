# ADR 0035: Save existing documents in place

## Status

Accepted; supersedes ADR 0033's every-save destination rule.

## Context

ADR 0033 made every Save open a native destination dialog, including saves of existing source documents. This incorrectly turned ordinary Save into Save As and interrupted editing even though the document already had a file path.

## Decision

Save writes an existing source document back to its authorized path without a destination dialog. This applies to the toolbar, Cmd/Ctrl+S, and Save in unsaved-changes guards. In-place saves retain canonical-path validation, baseline conflict detection, and atomic writes.

An untitled document still requires a native destination dialog for its first save. Cancel preserves the edit buffer and pending action. A successful first save migrates its identity to the saved source document; later saves use that path directly. Explicitly saving a copy, including the external-conflict action, still requires a destination and preserves the original file.

## Consequences

- Save does not ask readers to repeatedly confirm a known filename or location, even when there are no content changes.
- Conflicts, missing files, and write failures preserve unsaved work; ordinary Save never silently switches to a copy or another destination.
- Untitled creation, recovery drafts, and guarded navigation keep ADR 0033's behavior apart from destination selection after the first save.
- Electron regressions assert both the written contents and the absence of native destination-dialog calls for existing documents and subsequent saves of newly created documents.
