# Themes, custom design, and layout failures

Official templates combine design elements such as structure, item, and title. Prefer a template matching the information structure for ordinary tasks. Use `design` for a real layout need and verify registered element names in the current runtime.

## Custom design and local theme (example)

```infographic
infographic
design
  structure
    type list-row
    gap 24
  item
    type compact-card
  title
    type default
data
  title Validation priorities
  lists
    - label Content
      desc Verify facts
    - label Layout
      desc Check readability
theme light
  colorPrimary #426B87
  title
    fill #29485D
  item
    label
      font-weight 700
```

After changing title font size, inspect actual line height and occupied space, not just parsing. This example has no template name because its complete design supplies structure and items. It is not an incomplete declaration; Fuxian supports this official usage.

## Style choices

Use palette to distinguish parallel items and title/item theme settings for text hierarchy. Check the current stylize structure for patterns, rough rendering, or gradients. Set fields with a reading purpose rather than copying large default configurations.

Prefer available local Lucide/MDI icons. `illus`, resource objects, and trusted online resources can be used within Fuxian's resource boundaries. Verify target-language fonts in the actual environment rather than assuming any named font exists.

Provide explicit types for structure/item/items in custom design; a fragment without type does not necessarily inherit a template component.

## Common problems

| Symptom                                       | Check                                                    | Correction                                                                 |
| --------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Title appears but items are empty             | Required fields and root structure                       | Use lists/sequences/compares/root/nodes according to the template          |
| Type is required                              | Missing type on a custom element                         | Complete structure/item/items types and rerender a complete example        |
| Template does not exist                       | Spelling and target dependency version                   | Look up exact getTemplates names rather than inventing variants            |
| Children are missing                          | Indentation, children levels, and description visibility | Use a hierarchy-capable template and verify parent/child ownership         |
| Awkward single-character wrapping             | Card width or long descriptions                          | Shorten copy or use vertical/grid layout, rather than only shrinking fonts |
| Icons are blank but text is intact            | Resource name or access failure                          | Use known local icons and retain complete textual meaning                  |
| Raw SVG works but Fuxian differs              | Sanitized styles/resources and runtime boundaries        | Inspect in the target app and avoid unsupported resource references        |
| Screen looks correct but PDF loses key points | Meaning depends on animation timing                      | Keep main information statically readable and inspect the exported frame   |

## Animation and output

Animated templates are not categorically unsupported. When requested, select an actually registered template and check that static frames retain nodes, relationships, and labels. Movement must not be the only relationship cue in a PDF.

Deliver an `infographic` fence by default; Fuxian renders it, so a CDN HTML wrapper is unnecessary. See [validation.md](../validation.md) for shared checks.
