# ADR 0005: Forward system open requests to the document session

## Status

Accepted

## Decision

Fuxian owns one application instance. The primary process accepts command-line paths, macOS `open-file` events, and Electron `second-instance` arguments, validates them through the same canonical read path used by the file picker, and forwards typed results to the main renderer.

The preload bridge queues results until the renderer subscribes. The renderer queues them again until persisted session restoration finishes, then adds them through the existing document-session operation. Canonical paths provide deduplication, the first requested document becomes active, and other requested documents join the current session.

## Consequences

Double-click, “Open With,” and CLI requests behave consistently without exposing arbitrary filesystem access to the renderer. A later request focuses the primary window. Packaging must register `.md` and `.markdown` as viewer associations. Linux retains the CLI behavior but is not an MVP release target.
