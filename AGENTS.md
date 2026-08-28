# Repository Guidelines

## Project Structure & Module Organization

The Electron app lives in `apps/desktop/src/{main,preload,renderer}`. Shared packages cover Markdown rendering, document CSS, render readiness, and cross-process types. Keep end-to-end tests in `tests/` and representative Markdown in `fixtures/`.

The Markdown renderer must remain independent of React and Electron. Application-shell styles belong in the renderer app; rendered document styles belong in the preview iframe.

## Product & UI Architecture

Fuxian is a read-only finished-document reader, not an editor or knowledge workspace. Read `CONTEXT.md` before changing product terminology or concepts.

Use shadcn/ui for the application shell, with Tailwind CSS, the default Radix base, CSS variables, and Lucide icons. Generated components are project-owned: adapt them to Fuxian's technical-publication design. Compose product controls from these primitives instead of adding another headless UI system.

Keep shadcn components, Tailwind utilities, and application-shell styles out of `markdown-renderer`, `document-theme`, and the preview iframe.

## Build, Test, and Development Commands

Use Corepack-managed pnpm; root scripts are authoritative:

- `pnpm install`, `pnpm dev`, `pnpm build`: install, develop, and bundle.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`: run static checks and Vitest.

## Coding Style & Naming Conventions

Write strict TypeScript with two-space indentation; defer formatting to Prettier and ESLint. Use `PascalCase` for React components and types, `camelCase` for functions and variables, and kebab-case for other files. Keep IPC contracts typed, narrow, and validated. Prefer Markdown AST transforms over regular-expression HTML rewriting.

## Testing Guidelines

Name Vitest files `*.test.ts(x)` and Playwright files `*.spec.ts`. Prioritize unsafe content, relative resources, diagram failures, file watching, and deterministic PDF output. PDF tests must wait for `export-ready`.

Electron E2E runs hidden by default. Use `FUXIAN_E2E_WINDOW_MODE=secondary` for visual debugging on a non-primary display, optionally with `FUXIAN_E2E_DISPLAY_ID`; use `visible` only for explicitly requested foreground QA.

## Commit & Pull Request Guidelines

Use scoped Conventional Commits, for example `feat(renderer): add Mermaid task tracking`. Pull requests should cover behavior, tests, issues, and security. Include screenshots for UI changes and a sample PDF for rendering changes.

## Security & Configuration

Keep Electron isolation and sandboxing enabled, Node integration disabled, and file access behind validated preload APIs. Sanitize HTML, open external links in the system browser, and serve local assets through a controlled protocol. Put defaults in `.env.example`; never commit secrets or machine-specific PlantUML endpoints.

## Agent References

- Issues and labels: `docs/agents/issue-tracker.md` and `docs/agents/triage-labels.md`.
- Domain documentation changes: `docs/agents/domain.md`.
- UI, diagrams, export, or external-update behavior: read `docs/design/interface-prototype.md`. Pencil defines structure; repository docs define behavior.
- PlantUML transport, session restoration, file watching, or UI foundations: read the relevant `docs/adr/` record and record durable changes as a new ADR.
