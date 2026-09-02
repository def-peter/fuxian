---
status: superseded by ADR-0015
---

# Automatically track open read-only documents

While Fuxian remains a read-only finished-document reader, it watches every open source document and automatically recognizes stable external revisions without asking for reload confirmation. The active document renders immediately; inactive documents render at low priority, cancel obsolete work, and retain only the latest revision task. Switching can show the last successful version while the latest finishes. If local editing is introduced later, this decision must be reopened so unsaved content cannot be overwritten silently.
