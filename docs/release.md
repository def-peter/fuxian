# Release Packaging

Fuxian publishes stable updater-compatible builds for Windows x64, macOS Intel, and macOS Apple Silicon. Linux remains a development and CI target only.

## Production prerequisites

The updater reads anonymous assets from `def-peter/fuxian` GitHub Releases. The repository must therefore be **public** before dispatching a production release. Never embed a GitHub token in the application.

Configure these GitHub Actions secrets:

| Secret                                 | Purpose                                           |
| -------------------------------------- | ------------------------------------------------- |
| `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | Authenticode certificate and password             |
| `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` | Developer ID Application certificate and password |
| `APPLE_API_KEY_BASE64`                 | Base64-encoded App Store Connect `.p8` key        |
| `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` | Apple notarization API identifiers                |

Keep credentials only in GitHub Actions secrets. The workflow fails before packaging when any credential is absent.

## Local verification

From the repository root:

```bash
pnpm verify:release-version
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm package:dir
pnpm verify:package
```

`package:mac` builds DMG and ZIP locally and requires a usable signing/notarization identity. `package:win` must run on Windows. Outputs use `release/`.

## Publish a version

1. Set the same stable SemVer in `package.json` and `apps/desktop/package.json`; confirm that `v<version>` does not already exist.
2. Update release-facing documentation, commit, and push the exact source revision to `main`.
3. Dispatch **Build release installers**:

```bash
gh workflow run release-installers.yml --ref main
```

4. The workflow runs checks and E2E, produces signed Windows NSIS metadata, and builds both signed/notarized macOS architectures in one job so `latest-mac.yml` contains both ZIPs.
5. It verifies Authenticode, codesign, notarization tickets, packaged smoke tests, asset presence, size, and SHA-512. Assets enter a draft Release first; only the complete verified draft becomes the stable latest Release.

Published assets include `latest.yml`, `latest-mac.yml`, NSIS EXE, macOS ZIP and DMG files, and matching blockmaps.

## First-release acceptance

Before announcing updater support, install a signed lower version on Windows x64, macOS x64, and macOS arm64. On each platform verify: check, explicit download, progress, restart/install, restored document session and reading position, and the new version in “关于与更新”. Also test offline checks and a cancelled download.

If packaging fails, fix the source or credential and rerun before a draft exists. If draft upload or verification fails, inspect the draft, delete the incomplete draft/tag only after confirming its exact version, then rerun. Never publish partial updater metadata or replace assets on an already public version; increment the version instead.
