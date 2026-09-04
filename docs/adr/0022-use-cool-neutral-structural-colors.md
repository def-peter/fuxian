# ADR 0022: Use cool-neutral structural colors

## Status

Accepted

## Decision

Fuxian uses cool neutral grays for surfaces, structural text, borders, hover states, code containers, and paper-preview chrome in both light and dark appearances. Blue remains reserved for keyboard focus, active progress, and deliberate emphasis. Green, amber, and red remain available only where they communicate success, warning, danger, or authored syntax and diagram meaning.

The application shell and finished document keep separate semantic token contracts. Shell roles remain in `styles.css`; document and Fuxian code-theme roles remain in `document-theme`. Paper-preview status and elevation reuse document-theme tokens instead of hard-coded gray values. GitHub code themes and author-provided diagram, visualization, and infographic colors are unchanged.

## Consequences

Token definitions, rather than individual consumers, control future palette changes. Light and dark mappings require contrast checks and representative Electron screenshots. New non-semantic colors must use an existing structural role or justify a new semantic token; arbitrary green-gray component values are not accepted.
