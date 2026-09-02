# Fuxian Design System

> Status: Accepted shell token contract. This document records the shared visual foundation. It does not authorize a layout redesign.

## Scope

The design system covers the Electron application shell: the document-session sidebar, finished-document toolbar, content outline, settings window, controls, and overlays. It must preserve Fuxian's flat, quiet, low-fatigue character.

The following remain separate:

- Finished-document typography and colors belong to `document-theme` and the preview iframe.
- Author-defined Markdown, diagram, visualization, and infographic colors are never remapped.
- Code-theme preview swatches represent their source themes and are not shell tokens.
- Paper geometry and document-width behavior are product layout rules, not shell styling tokens.

## Baseline Audit

The migration began from a useful shadcn foundation whose generic tokens did too many jobs.

| Finding                                                                                                             | Consequence                                                     |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `background`, `card`, and `muted` represent windows, sidebars, toolbars, stages, documents, skeletons, and controls | A palette change improves one region while degrading another    |
| The settings window overrode the complete light token set under `.settings-window`                                  | Main and settings windows could drift visually                  |
| Feature modules compose borders, radii, shadows, and states directly                                                | Similar controls have subtly different treatments               |
| Focus, selection, update, success, and warning colors have evolved independently                                    | State meaning is not predictable                                |
| Shared shadcn primitives exist under `components/ui/`                                                               | The inconsistency can be fixed without adding another UI system |

Intentional raw colors in tests, code-theme swatches, sanitized authored content, and print fallbacks are excluded from the shell audit.

## Principles

1. Name semantic tokens by visual responsibility, not by their current color.
2. Use fewer neutral surfaces; separation should primarily come from spacing and one-pixel borders.
3. Reserve blue for focus and deliberate emphasis. Primary commands remain near-black.
4. Use shadows only for paper, menus, popovers, dialogs, drawers, and other elevated layers.
5. Keep controls compact, with approximately four-pixel radii and stable dimensions.
6. Add component-specific tokens only when a shared primitive cannot express the contract clearly.

## Token Architecture

```text
Primitive values
  neutral scale, focus blue, danger, dimensions, radius, motion, elevation
        |
Semantic roles
  shell surfaces, text, borders, interaction states, overlays
        |
Component recipes
  icon button, navigation item, segmented control, tooltip, popover, panel header
```

### Primitive Values

These values promote the approved light settings direction across the application shell while reducing arbitrary gray variants. They are implementation details, not a public palette API.

| Token              | Candidate | Purpose                               |
| ------------------ | --------- | ------------------------------------- |
| `--fx-neutral-0`   | `#ffffff` | White surfaces                        |
| `--fx-neutral-50`  | `#f6f6f7` | Quiet navigation and hover surface    |
| `--fx-neutral-100` | `#f0f1f2` | Window canvas and preview stage       |
| `--fx-neutral-150` | `#e9eef3` | Selected control or navigation state  |
| `--fx-neutral-200` | `#e4e6e8` | Subtle separators and borders         |
| `--fx-neutral-600` | `#626b74` | Secondary text                        |
| `--fx-neutral-800` | `#2d3439` | Strong secondary text                 |
| `--fx-neutral-900` | `#24282c` | Primary text                          |
| `--fx-command`     | `#292d32` | Primary command surface               |
| `--fx-focus`       | `#1976c9` | Keyboard focus and explicit emphasis  |
| `--fx-danger`      | `#a8453d` | Destructive and blocking error states |

Tailwind's spacing scale remains authoritative. Fuxian should introduce dimensional primitives only for repeated shell contracts such as 24, 28, and 36 pixel controls, 44 pixel panel headers, overlay elevation, and motion duration.

### Semantic Contract

| Group       | Tokens                                                                                                                         | Intended use                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| Surfaces    | `surface-shell`, `surface-sidebar`, `surface-toolbar`, `surface-panel`, `surface-stage`, `surface-document`, `surface-overlay` | Stable application regions                                              |
| Text        | `text-primary`, `text-secondary`, `text-tertiary`, `text-on-command`, `text-danger`                                            | Readability hierarchy and status                                        |
| Borders     | `border-subtle`, `border-control`, `border-strong`                                                                             | Separators, inputs, and emphasized boundaries                           |
| Interaction | `interactive-hover`, `interactive-selected`, `interactive-pressed`, `focus-ring`                                               | Consistent control states                                               |
| Status      | `status-danger`, `status-update`, `status-success`, `status-warning`                                                           | Meaningful system state; update, success, and warning remain restrained |
| Elevation   | `shadow-paper`, `shadow-popover`, `shadow-dialog`                                                                              | The only approved shadow roles                                          |

`surface-document` is the shell-side frame around a finished document. It does not style the iframe document itself.

### shadcn Compatibility

Generic shadcn variables remain available inside shared primitives, but they alias the more explicit semantic contract. Feature code should prefer role-specific utilities for application regions.

```css
@theme inline {
  --color-surface-sidebar: var(--surface-sidebar);
  --color-surface-toolbar: var(--surface-toolbar);
  --color-surface-stage: var(--surface-stage);
  --color-fg-secondary: var(--text-secondary);
  --color-line-subtle: var(--border-subtle);
  --color-interactive-selected: var(--interactive-selected);
  --color-focus: var(--focus-ring);
}

:root {
  --background: var(--surface-shell);
  --foreground: var(--text-primary);
  --card: var(--surface-panel);
  --muted: var(--surface-sidebar);
  --accent: var(--interactive-hover);
  --border: var(--border-subtle);
  --ring: var(--focus-ring);
}
```

This keeps generated shadcn components compatible while preventing feature code from using `bg-card` to mean both a toolbar and a document.

## Component Recipes

Repeated visual behavior belongs in shared components, preferably through CVA variants rather than feature-local class lists.

| Recipe            | Contract                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| Icon button       | Fixed square sizes, transparent idle state, shared hover, focus, pressed, and disabled states                         |
| Navigation item   | Full-row target, selected surface, primary label, optional secondary metadata, trailing action kept clear of tooltips |
| Segmented control | Quiet track, compact height, borderless idle items, stable selected surface                                           |
| Panel header      | Stable 44 pixel height, one separator, primary title and compact actions                                              |
| Tooltip           | One delay policy, non-interactive content, `surface-tooltip` and `text-on-tooltip`, consistent offset and padding     |
| Popover           | White overlay surface, subtle border, overlay shadow, Escape and outside-click dismissal                              |
| Sheet             | Shell surface, restrained scrim, directional motion, and shared close-button behavior                                 |
| Input             | Shared control border, placeholder hierarchy, focus ring, invalid state, and disabled treatment                       |
| Slider            | Quiet track, command-colored range, white thumb, and the shared focus ring                                            |
| Scroll area       | Subtle thumb at rest and the shared keyboard-focus treatment                                                          |
| Status feedback   | Panel-based alerts and one shared progress color with explicit danger treatment                                       |
| Resizable divider | Visually quiet at rest, stronger only on hover, drag, or keyboard focus                                               |

## Usage Rules

- Use semantic utilities such as `bg-surface-sidebar`, never primitive utilities in feature components.
- Use primitives only while defining semantic variables.
- Keep state styling in the owning shared primitive when the behavior repeats.
- Do not add a token for a one-off measurement unless it expresses a durable product rule.
- Do not use color alone to communicate update, error, selected, or focus state.
- Treat token changes as shared API changes and cover them with contrast and visual tests.

## Migration Record

1. Semantic roles and shadcn compatibility aliases live in `styles.css`.
2. Shared primitives own repeated control states and visual recipes.
3. Main and settings windows consume the same light semantic contract without window-local palette overrides.
4. Shell regions use explicit surface, text, border, interaction, and status roles.
5. Role-based assertions, contrast checks, and representative Electron screenshots protect the contract.
6. Dark mode retains independent semantic mappings for later visual refinement.

Each migration step must remain independently reviewable and must not cross into the finished-document iframe.
