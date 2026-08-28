<p align="center">
  <img src="design/logo/final/app-icon/fuxian-app-icon-128.png" alt="浮现 Fuxian" width="128" height="128" />
</p>

# 浮现 (Fuxian)

浮现是一款面向 Windows 和 macOS 的只读 Markdown 桌面阅读器，将 Markdown 源文件呈现为适合阅读、演示和 PDF 交付的成品文档。

Fuxian is a polished, read-only Markdown desktop reader for Windows and macOS. It renders technical documents with Mermaid, PlantUML, Vega-Lite, AntV Infographic, KaTeX, local images, and deterministic PDF export.

## Features

- Read multiple independent Markdown documents in one restorable session.
- Track external file changes without interrupting the current reading position.
- Render Mermaid, PlantUML, Vega-Lite, AntV Infographic, KaTeX, tables, and code.
- Inspect and copy selectable diagram content instead of flattening it into images.
- Export complete finished documents to PDF after asynchronous diagrams are ready.
- Keep Markdown rendering isolated from the Electron and React application shell.

## Requirements

- Node.js 22.12 or newer
- Corepack-managed pnpm 11.18

## Development

```bash
pnpm install
pnpm dev
```

Use `pnpm build` for a production bundle, `pnpm typecheck` and `pnpm lint` for static checks, `pnpm test` for Vitest, and `pnpm format:check` to verify formatting.

Release packaging and the manually dispatched installer workflow are documented in [`docs/release.md`](docs/release.md). Production releases require signed Windows x64 artifacts and signed, notarized macOS x64/arm64 artifacts. Linux remains a development and CI platform.

## Workspace

- `apps/desktop`: Electron main, preload, and React renderer processes
- `packages/markdown-renderer`: framework-independent Markdown pipeline
- `packages/document-theme`: isolated document presentation styles
- `packages/render-protocol`: asynchronous render readiness contract
- `packages/shared-types`: shared process and package types

## License

Fuxian is available under the [MIT License](LICENSE). Bundled third-party software remains subject to the licenses listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
