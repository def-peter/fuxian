# ADR 0012: Use platform-specific update delivery

## Status

Accepted

## Decision

Fuxian checks the stable public GitHub Releases feed after startup and on demand. Update checks remain in the Electron main process, never block document restoration, and expose only typed status through preload.

Windows uses `electron-updater` for explicit download and NSIS installation. The first public releases are unsigned: users may see an “unknown publisher” or Microsoft Defender SmartScreen warning. Fuxian still verifies updater metadata checksums and never silently downloads or installs. Code signing can be added later without changing the renderer contract.

macOS uses the same feed only to detect a new version and display inert release notes. It never downloads or installs an update in-app. The action opens the matching `def-peter/fuxian` GitHub Release in the system browser, where the user chooses the correct Intel or Apple Silicon DMG. macOS artifacts are unsigned and not notarized, so Gatekeeper may require explicit user approval.

Linux remains outside the release target. AppImage updates may be considered when Linux distribution becomes official; package-managed formats should remain under their package manager.

The release workflow requires no signing credentials. It builds Windows x64 and both macOS architectures, verifies packaged smoke tests and updater metadata, then publishes all artifacts together from a draft Release.

## Consequences

The project can publish without recurring certificate programs, and platform behavior is honest about what is actually supported. Windows retains the most convenient update path, while macOS avoids presenting an unsafe or nonfunctional unsigned auto-install flow. The tradeoff is stronger operating-system warnings and no verified publisher identity until signing is funded or an eligible free signing service is adopted.
