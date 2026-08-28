# Application Shell Palette Prototype

> Throwaway prototype for #31. The question is: which neutral light palette should replace, or refine, the current mineral-green application shell?

Run from the repository root:

```bash
pnpm prototype:theme
```

Open the printed local URL. Switch with the bottom controls, the left/right arrow keys, or `?variant=A`, `B`, `C`, and `D`. Layout, dimensions, content, selection, and command placement are deliberately identical; only semantic color tokens change.

## Variants

| Key | Direction                   | Shell / panel         | Primary   | Selected  | Focus     | Assessment                                                                                  |
| --- | --------------------------- | --------------------- | --------- | --------- | --------- | ------------------------------------------------------------------------------------------- |
| A   | Current baseline            | `#EDF0F2` / `#EEF1F4` | `#25684F` | `#D2E4DC` | `#4B856E` | Useful control; green still dominates selection and commands.                               |
| B   | Cool neutral                | `#E9EDF0` / `#F2F5F7` | `#292D32` | `#E0E5E9` | `#5B6672` | Quiet and cohesive, but state communication becomes overly neutral.                         |
| C   | Layered grayscale           | `#E3E7EA` / `#F0F2F4` | `#222629` | `#D4D9DE` | `#666F76` | Strongest spatial hierarchy; shell can compete with the document.                           |
| D   | Neutral plus semantic color | `#E8ECEF` / `#F2F5F7` | `#272B2E` | `#E0E5E9` | `#4B6F8C` | Recommended: neutral by default, with color reserved for focus, status, warning, and error. |

## Recommendation

Use **D** as the implementation direction, with B as the fallback if a strictly grayscale shell is preferred. D keeps the white finished document dominant and uses near-black rather than pure black for primary actions. Its limited blue focus, green success, amber warning, and red error tokens preserve state recognition and accessibility without returning to a green-led interface.

The prototype intentionally omits dark mode, responsive behavior, and complete component states. Those belong to the production follow-up after a palette is selected.
