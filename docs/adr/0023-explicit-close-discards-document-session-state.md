# ADR 0023: Discard document-session state on explicit close

## Status

Accepted

## Decision

Explicitly closing a document removes it from the open-document session and discards its reading position, successful render snapshot, update state, editor selection, and other session-only state. Fuxian retains only a recent-history entry containing the document identity and last-viewed time, so reopening that entry starts a fresh session at the top of the document. Removing the recent-history entry does not delete the source file.

Application exit is deliberately different: quitting or restarting preserves the ordered open-document set, active document, and restorable reading positions as established by ADR 0002. This distinction makes `关闭文档` a genuine end to the document session while preserving continuity across ordinary application restarts.

## Consequences

- The `正在查看` and `最近查看` remove controls may share placement and interaction styling while performing different domain actions.
- Closed documents cannot silently retain stale rendering or reading state.
- Unsaved edit buffers and recovery drafts still require explicit resolution before close under ADR 0015.
