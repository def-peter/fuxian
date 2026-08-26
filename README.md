# Fuxian

Fuxian is a focused Electron application for opening and presenting Markdown documents.

## Requirements

- Node.js 22.12 or newer
- Corepack-managed pnpm 11.18

## Development

```bash
pnpm install
pnpm dev
```

Use `pnpm build` for a production bundle, `pnpm typecheck` and `pnpm lint` for static checks, `pnpm test` for Vitest, and `pnpm format:check` to verify formatting.

## Workspace

- `apps/desktop`: Electron main, preload, and React renderer processes
- `packages/markdown-renderer`: framework-independent Markdown pipeline
- `packages/document-theme`: isolated document presentation styles
- `packages/render-protocol`: asynchronous render readiness contract
- `packages/shared-types`: shared process and package types
