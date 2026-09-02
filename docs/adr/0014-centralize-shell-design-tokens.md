# ADR 0014: Centralize application-shell design tokens

## Status

Accepted

## Decision

Fuxian defines one semantic design-token contract for every Electron application-shell window. Tailwind CSS v4 exposes the contract through `@theme inline`; shared shadcn/ui primitives keep compatibility aliases such as `background`, `accent`, and `ring`, while feature code uses explicit roles such as `surface-sidebar`, `surface-toolbar`, `text-secondary`, `border-subtle`, and `focus-ring`.

The approved light palette uses `#F0F1F2` for the shell canvas and document stage, `#F6F6F7` for quiet navigation regions, white for toolbars, panels, overlays, and document frames, `#E4E6E8` for separators, `#24282C` for primary text, and `#1976C9` for keyboard focus and deliberate emphasis. Primary commands remain near-black. Shared interaction and status roles prevent individual features from inventing visually similar states.

Shared component recipes remain project-owned under `components/ui/`. Repeated behavior belongs there, preferably as variants, rather than in feature-local class lists. Fuxian does not add another general-purpose headless UI system, a token-generation pipeline, or a second component library unless maintenance evidence justifies revisiting this decision.

The contract applies only to the application shell. Finished-document typography and colors remain owned by `document-theme` inside the preview iframe. Author Markdown, diagrams, visualizations, infographics, code themes, and paper geometry are never remapped through shell tokens.

## Consequences

Main and settings windows share one visual vocabulary and can evolve without palette overrides. Generic shadcn aliases remain implementation-compatible but are not sufficient names for application regions. Token changes become shared API changes and require contrast, component-state, and representative window tests. Dark mappings remain separate semantic values and can be refined without changing feature markup.
