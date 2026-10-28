# ADR 0034: Observe deletions during watch registration

## Status

Accepted

## Context

A source document can disappear after it is opened but before its watches are registered. Rejecting that watch request leaves the document session unwatched, while accepting a missing initial fingerprint as the baseline prevents polling from ever reporting the deletion.

## Decision

Keep previously authorized canonical source paths in the watch set when registration encounters `ENOENT` or `ENOTDIR`. Existing request validation and canonical-path checks remain; other filesystem failures still reject registration.

When any initially watched path is unavailable, run the normal stable-revision probe instead of silently accepting that fingerprint. Delivery uses the existing coordinator and source-document read, so only a confirmed missing source document is forgotten; temporarily unreadable documents and unsaved edit buffers retain their existing protections. Stable probes, generation invalidation, polling, and recreation detection remain shared with later filesystem changes.

## Validation

Unit tests suppress native notifications and cover an initially deleted document, recreation, and invalidation on reconfiguration or closure. An Electron regression clears the watch set, deletes an authorized open document, and registers its watches again through the public bridge; the document must leave both the open session and recent history.
