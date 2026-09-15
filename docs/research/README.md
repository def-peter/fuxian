# Research notes

Commit research conclusions that help maintain the project: the question, investigation date, applicable versions, primary-source citations, findings, alternatives, and unresolved questions. Keep necessary minimal reproductions, reusable validation scripts, and selected evidence with the report when they make a finding reproducible or reviewable.

Mark historical reports with their investigation stage. Link to subsequent decisions or validation summaries instead of presenting old recommendations as current implementation facts. Research findings inform decisions; adopted architecture decisions belong in `docs/adr/`.

Keep bulk screenshots, raw experiment outputs, temporary logs, duplicate source snapshots, and release archives outside this directory. Use an ignored root `tmp/` or `output/` directory for disposable work, or an external archive for evidence that should be retained locally. Promote selected results deliberately; do not ignore the entire `docs/research/` directory. A clean working tree is not a reason to discard useful findings.
