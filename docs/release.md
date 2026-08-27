# Release Packaging

Fuxian packages the MVP for Windows x64, macOS Intel, and macOS Apple Silicon. Linux is supported for development and CI verification only; no Linux installer is published for the MVP.

## Local packaging

Use Corepack-managed pnpm from the repository root:

```bash
pnpm package:dir
pnpm verify:package
pnpm package:mac
```

`package:win` must run on Windows. Output is written to `release/`. The verifier checks that the application archive contains the production main, preload, and renderer bundles, does not include a second Electron runtime, retains BrowserWindow security settings and the production CSP, and does not reference a development renderer.

## GitHub release

Increase the matching versions in `package.json` and `apps/desktop/package.json`, then dispatch **Build release installers** from `main`:

```bash
gh workflow run release-installers.yml --ref main
```

The workflow rejects an existing version, runs formatting, lint, type checking, Vitest, and the Electron Playwright suite, repeats the end-to-end suite on Windows and both macOS architectures, builds and verifies all three installers, and creates `v<version>` only after every platform succeeds.

The current workflow disables certificate discovery. Its Windows installer is unsigned and its macOS DMGs are unsigned and unnotarized, so operating systems may show trust warnings. Signing and notarization require a separate credentialed release change.
