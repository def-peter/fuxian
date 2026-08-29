# Release Packaging

Fuxian publishes stable builds for Windows x64, macOS Intel, and macOS Apple Silicon. Windows supports user-triggered download and installation in the app. macOS detects new versions and opens the matching GitHub Release for manual download. Linux remains a development and CI target only.

## Production prerequisites

The updater reads anonymous assets from `def-peter/fuxian` GitHub Releases. The repository must therefore be **public** before dispatching a production release. Never embed a GitHub token in the application.

No signing secrets are required. Current Windows and macOS artifacts are unsigned. Windows may show an unknown-publisher or SmartScreen warning; macOS may require explicit Gatekeeper approval. Never describe these builds as signed or notarized.

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

`package:mac` builds unsigned DMG and ZIP artifacts. `package:win` must run on Windows. Outputs use `release/`.

## Publish a version

1. Set the same stable SemVer in `package.json` and `apps/desktop/package.json`; confirm that `v<version>` does not already exist.
2. Update release-facing documentation, commit, and push the exact source revision to `main`.
3. Dispatch **Build release installers**:

```bash
gh workflow run release-installers.yml --ref main
```

4. The workflow runs static checks, unit tests, and a release-critical Electron E2E suite on both Windows and macOS; produces Windows NSIS update metadata; and builds both unsigned macOS architectures in one job so `latest-mac.yml` can detect either architecture. Run the broader `pnpm test:e2e` suite during feature development.
5. It verifies both macOS package structures, smoke-tests the Windows and native Apple Silicon applications, and validates asset presence, size, and SHA-512 metadata. GitHub's Apple Silicon runner cannot launch the Intel build without Rosetta, so the Intel application requires the manual acceptance check below. Assets enter a draft Release first; only the complete verified draft becomes the stable latest Release.

Published assets include `latest.yml`, `latest-mac.yml`, NSIS EXE, macOS ZIP and DMG files, and matching blockmaps.

## First-release acceptance

Before announcing updater support, install a lower version on Windows x64 and verify: check, explicit download, progress, restart/install, restored document session and reading position, and the new version in “关于与更新”. On macOS x64 and arm64, launch each packaged architecture on matching hardware, then verify that checking finds the version and opens its GitHub Release without starting an in-app download. Also test offline checks, a cancelled Windows download, SmartScreen behavior, and Gatekeeper instructions.

If packaging fails, fix the source or credential and rerun before a draft exists. If draft upload or verification fails, inspect the draft, delete the incomplete draft/tag only after confirming its exact version, then rerun. Never publish partial updater metadata or replace assets on an already public version; increment the version instead.
