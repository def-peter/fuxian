# ADR 0011: Deliver user-controlled signed software updates

## Status

Superseded by ADR 0012

## Decision

Fuxian uses `electron-updater` in the Electron main process for stable-channel updates on packaged Windows and macOS builds. The renderer receives a typed status snapshot and may request check, download, cancel, or install operations, but it cannot provide an update URL, local path, command argument, or release HTML.

Fuxian checks once after a delayed startup interval and also exposes “检查更新…” in Help and “关于与更新” in Settings. It never downloads silently. After an explicit download, installation requires “重启并更新”; a normal quit does not install the update. Before installation, the main process rejects active PDF export and waits for the renderer to persist the document session and active reading position.

Production releases use one stable GitHub Releases feed. Windows NSIS artifacts must be Authenticode signed. Both macOS architectures must be Developer ID signed and notarized; DMG and ZIP artifacts are published together. The workflow uploads updater metadata and blockmaps to a draft Release, verifies names, sizes, and SHA-512 values, then makes the complete Release visible atomically.

Development mode never contacts the production feed. Electron E2E uses an explicitly enabled fake adapter.

## Consequences

Update failures do not block startup, reading, or session restoration, and remote release notes remain inert text. Users retain control over network transfer and restart timing. A private GitHub repository cannot serve ordinary clients without distributing a token, so the release repository must be public before this update path is enabled. Production publishing is blocked until Windows signing and Apple signing/notarization credentials are configured. Every supported platform still requires a real signed cross-version upgrade test before the first public release.
