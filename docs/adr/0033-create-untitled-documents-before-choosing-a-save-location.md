# ADR 0033: Create untitled documents before choosing a save location

## Status

Accepted

## Decision

New Markdown opens an empty untitled document directly in source editing mode, with editor focus. Choosing a filename and location is deferred until save; creating a document never writes an empty Markdown file to disk.

Every save, including subsequent saves and saves of already-open source documents, opens a native save dialog. The previous full file path and name are defaults, not authorization to write. Cancel preserves the editor and pending action. Confirming the same path retains ADR 0015's baseline conflict check; choosing a different path saves a copy, preserves the original file, and moves the active document to the selected file. A pending close follows the saved document's new identity.

Untitled documents use reserved `untitled:<UUID>` session identities, never filesystem paths or resource grants. The renderer session explicitly distinguishes them from source documents. File-session persistence, watches, recent history, reveal, and copy-path operations exclude these identities. Application-owned recovery drafts can retain their content and selection; restoration reconstructs untitled documents directly in editing mode without trying to read a nonexistent file.

The document-session header places a FilePlus2 action before Open. The start view retains Open as its primary action with New as a secondary action. The File menu and Cmd/Ctrl+N provide the same guarded action, including when the document-session sidebar is collapsed.

## Consequences

- An untouched blank document closes without a prompt and never enters recent history. Content changes require Save, Don't Save, or Cancel before leaving, closing, quitting, or updating.
- Recovery is application-owned draft persistence, not silent source-file saving. Recovered untitled documents remain unsaved until a reader confirms a destination.
- Only explicitly saved source documents enter reading and export. Returning from a blank untitled document closes it; returning with changes first settles the unsaved work.
- Save remains available with no content changes so readers can choose another location, or explicitly save an empty Markdown document.
- This extends ADRs 0002 and 0015 without weakening file-access validation or external-conflict protection.
