# Keep diagnostics local and content-free

Fuxian records structured lifecycle, document-session, persistence, and failure events through electron-log in the main process. Correlate documents with locally keyed anonymous identifiers; omit document text, filenames, raw error messages, URLs, and absolute stack paths. This deliberately favors useful event history over unrestricted console forwarding or memory dumps, which can expose Markdown content.

Retain at most seven calendar days and 10 MB of logs. Settings provides explicit export and clear actions in both languages; clearing also rotates the identifier key. No automatic upload or reporting server is used. A local running marker detects a previous unclean exit but cannot distinguish a crash from force-quit or power loss. Diagnostics never replace recovery drafts or session persistence, and logging failures must not interrupt those workflows.
