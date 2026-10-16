# ADR 0031: Probe open documents without native file events

## Status

Accepted

## Decision

Keep native directory watches for prompt external revisions, and also probe the metadata of each open source document and its referenced local resources every two seconds. Native filesystem notifications can be unavailable or silently incomplete for shared filesystems, including Windows access to WSL files. Successful watcher creation does not guarantee future events.

Polling compares modification time and size with the accepted fingerprint. A changed fingerprint enters the existing stable-revision probe; polling does not restart an ongoing stability check or deliver a separate revision. Unchanged files require metadata reads only. Polls do not overlap within a watcher, and reconfiguration or closing invalidates outstanding work and clears the polling timer. An empty watch set starts no timer.

The existing open-document coordinator still controls active and inactive revision priority, and dirty edit buffers retain their external-conflict protection.

## Validation and limits

Regression tests modify real temporary files while native watch notifications are suppressed, unavailable, or errored. They cover atomic saves, referenced resource updates, deletion, recreation, reconfiguration, and closure. These tests validate the missing-event fallback on the development host; they do not establish Windows/WSL integration acceptance.

Detection normally takes up to the two-second polling interval plus stability checks and filesystem latency when events are absent. A content change preserving both modification time and size is outside this metadata-based fallback. Polling adds metadata requests proportional to the number of watched paths, without reading entire documents on every tick.
