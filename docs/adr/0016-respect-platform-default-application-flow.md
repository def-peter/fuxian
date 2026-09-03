# ADR 0016: Respect platform default-application flow

## Status

Accepted

## Decision

Fuxian detects `.md` and `.markdown` associations independently in packaged Windows and macOS builds. Windows reads the current per-user `UserChoice` file class, with the registered class as a fallback, and verifies that its open command points to the running executable. macOS asks Standard Additions for each extension's Launch Services default application and compares the resolved application bundle with the running bundle.

Changing the default is always an explicit user action. The per-user Windows installer registers `Fuxian` under `RegisteredApplications`, declares `.md` and `.markdown` through `Software\Fuxian\Capabilities`, and maps both extensions to the application-specific `Fuxian.Markdown` ProgID. The running application opens the matching registered-app settings page and leaves `UserChoice` confirmation to Windows. On Windows versions that do not support the registered-app deep link, the settings UI tells the user to search for `Fuxian` and confirm both extensions. macOS reveals a temporary Markdown example and presents the supported Finder “Open with” and “Change All” workflow. Fuxian never writes Windows `UserChoice` or Launch Services preferences itself.

Development builds report the feature as unavailable. Electron E2E may inject a deterministic status adapter, but it must not inspect or change the host's associations. The settings window refreshes detection whenever it regains focus and never treats registration or opening settings as proof of success.

## Consequences

Status can be fully associated, partially associated, not associated, or unavailable. Platform failures remain visible rather than producing a false success state. Installer declarations, the dedicated Markdown document icon, the status detector, and the expected ProgID must evolve together.
