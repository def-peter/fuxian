# Release Packaging

Fuxian publishes stable builds for Windows x64, macOS Intel, and macOS Apple Silicon. Windows supports user-triggered differential download and installation in the app. macOS downloads the matching full DMG in-app, supports explicit resume after interruptions or restart, and opens the verified installer for manual drag-and-drop installation. Both platforms offer a GitHub download fallback. Linux remains a development and CI target only.

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

## Build a Windows test version

From a clean, synchronized `main` branch, run:

```bash
pnpm release:test --wait
```

This dispatches **Build Windows test installer** without changing either package manifest, committing a version, creating a tag, or publishing a GitHub Release. CI assigns an isolated version such as `0.1.9-test.123` only inside its runner, executes the Windows release-critical tests, builds the unsigned NSIS installer, and uploads it as an Actions artifact for 30 days.

The helper prints the workflow URL and artifact name. Open that run, find **Artifacts**, and download `fuxian-windows-x64-test-<run-number>`. Test artifacts contain only the installer: they exclude `latest.yml`, blockmaps, and all other updater metadata, so installed stable versions cannot discover them. Use `--dry-run` for preflight checks or `--yes` to skip confirmation.

## Publish a version

Install and authenticate the GitHub CLI once, then run the release helper from a clean, synchronized `main` branch:

```bash
pnpm release
```

The default increments the patch version, asks for optional English and Chinese Markdown notes, updates both package manifests, commits `chore(release): prepare v<version>`, pushes `main`, and dispatches **Build release installers**. Use `pnpm release minor`, `pnpm release major`, or an explicit version such as `pnpm release 1.0.0` when needed. Add `--dry-run` to check the proposed version without changing anything, `--yes` to skip interactive input, or `--wait` to keep the terminal open until publishing finishes.

Use `--notes-en` and `--notes-zh` for non-interactive bilingual notes. English stays visible and Chinese appears in a native collapsible `中文更新日志` section. Both languages live in one GitHub Release body; no changelog file is required. Use `--notes "<Markdown>"` or `--notes-file <path>` only when supplying a complete custom body. A local file is read but never staged. Curated text is placed before GitHub-generated notes and the full changelog link. For example:

```bash
pnpm release --wait --notes-en "Add automatic update checks" --notes-zh "新增自动更新检测"
pnpm release minor --wait --notes-file /tmp/fuxian-release.md
```

Untracked files are reported but never staged. The helper refuses to run with tracked changes, from a branch other than `main`, when `main` differs from `origin/main`, or when the target tag or Release already exists.

The workflow runs static checks, unit tests, and a release-critical Electron E2E suite on both Windows and macOS; produces Windows NSIS update metadata; and builds both unsigned macOS architectures in one job so `latest-mac.yml` can detect either architecture. Run the broader `pnpm test:e2e` suite during feature development.

It verifies both macOS package structures, smoke-tests the Windows and native Apple Silicon applications, and validates asset presence, size, and SHA-512 metadata. GitHub's Apple Silicon runner cannot launch the Intel build without Rosetta, so the Intel application requires the manual acceptance check below. Assets enter a draft Release first; only the complete verified draft becomes the stable latest Release.

Published assets include `latest.yml`, `latest-mac.yml`, NSIS EXE, macOS ZIP and DMG files, and matching blockmaps.

## First-release acceptance

Before announcing updater support, install a lower version on Windows x64 and verify: check, explicit download, progress, restart/install, restored document session and reading position, and the new version in “关于与更新”. On macOS x64 and arm64, launch each packaged architecture on matching hardware, then verify explicit DMG download, progress, cancellation, retry after restart, checksum verification, and opening the correct installer. Check the GitHub fallback while downloading and after failed checks. Also test offline checks, a cancelled Windows download, SmartScreen behavior, and Gatekeeper instructions.

If packaging fails, fix the source or credential and rerun before a draft exists. If draft upload or verification fails, inspect the draft, delete the incomplete draft/tag only after confirming its exact version, then rerun. Never publish partial updater metadata or replace assets on an already public version; increment the version instead.
