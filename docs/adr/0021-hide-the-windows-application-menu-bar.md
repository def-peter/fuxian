# ADR 0021: Hide the Windows application menu bar

## Status

Accepted

## Decision

Fuxian keeps one Electron application menu on every platform so menu accelerators, native editing roles, and window commands continue to work. On Windows, every user-facing `BrowserWindow` permanently hides the native menu bar instead of using Electron's `autoHideMenuBar`, whose `Alt`-to-reveal behavior does not fit Fuxian's compact application shell. macOS retains its normal system menu, and other platforms keep Electron's default visibility.

The policy is centralized and applied to the main, settings, and PDF export windows, including after rebuilding the localized application menu. Settings, update actions, and the project homepage remain visible in the application shell. Development builds retain a `Cmd/Ctrl+Shift+I` accelerator for DevTools.

## Consequences

- Windows gains vertical space without exposing a temporary legacy menu or duplicating Electron's accelerator and role handling.
- Adding a new user-facing window requires applying the shared menu policy.
- Cross-platform Electron tests verify main and settings window behavior; release PDF and packaged-app tests verify hidden auxiliary and installed Windows windows.
