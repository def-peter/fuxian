# Repository Guidelines

## Project Structure & Module Organization

This repository is a pnpm workspace with the Electron application under `apps/desktop/` (`src/main`, `src/preload`, and `src/renderer`). Put reusable code in `packages/`: `markdown-renderer` for the AST pipeline, `document-theme` for document CSS, `render-protocol` for async readiness, and `shared-types` for cross-process contracts. Keep end-to-end tests in `tests/` and representative Markdown in `fixtures/showcase.md`.

The Markdown renderer must remain independent of React and Electron. Application-shell styles belong in the renderer app; rendered document styles belong in the preview iframe.

## Build, Test, and Development Commands

Use Corepack-managed pnpm. The root command contract is:

- `pnpm install`: install all workspace dependencies.
- `pnpm dev`: run the Electron app with Vite hot reload.
- `pnpm build`: produce production bundles.
- `pnpm lint` and `pnpm typecheck`: run static checks.
- `pnpm test`: run Vitest unit and integration tests.

Treat root `package.json` scripts as authoritative; update this section when they change.

## Coding Style & Naming Conventions

Write strict TypeScript with two-space indentation. Let Prettier and ESLint make formatting decisions once configured. Use `PascalCase` for React components and types, `camelCase` for functions and variables, and kebab-case for non-component filenames. Keep IPC channels and payloads typed, narrow, and validated. Prefer structured Markdown AST transforms over regular-expression HTML rewriting.

## Testing Guidelines

Name Vitest files `*.test.ts` or `*.test.tsx` and Playwright files `*.spec.ts`. Add focused tests for every behavior change. Prioritize unsafe HTML and URLs, relative resources, diagram failure/timeout states, file watching, and deterministic PDF output. PDF tests must wait for the explicit `export-ready` protocol, never a fixed delay.

## Commit & Pull Request Guidelines

History currently contains only `Initial commit`, so no convention is established. Use concise Conventional Commit messages such as `feat(renderer): add Mermaid task tracking`. Keep commits scoped. Pull requests should describe user-visible behavior, testing performed, linked issues, and security implications. Include screenshots for UI changes and a sample PDF when rendering or print behavior changes.

## Security & Configuration

Keep Electron context isolation and sandboxing enabled, Node integration disabled, and renderer file access behind validated preload APIs. Sanitize raw HTML, open external links in the system browser, and serve local assets through a controlled protocol. Never commit secrets or machine-specific PlantUML endpoints; document configurable defaults in `.env.example` when configuration is introduced.

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain layout. See `docs/agents/domain.md`.
