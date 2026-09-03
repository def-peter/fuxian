# ADR 0020: Centralize Application Localization

## Decision

Fuxian uses one typed application message catalog shared by the Electron main process and every renderer entry point. Chinese source messages are the compile-time keys and fallback; the English catalog must contain every key. React surfaces consume the catalog through `LocalizationProvider`, while non-React modules receive an explicit translator.

The saved interface-language preference is `system`, `zh-CN`, or `en-US`. `system` maps any locale beginning with `zh` to Simplified Chinese and maps every other, missing, or unknown locale to English. A manual preference wins over the operating-system locale, applies immediately to all open windows and the application menu, and persists in reader preferences.

Application localization is separate from document language. Fuxian never translates file names, paths, Markdown source, author content, custom Callout titles, diagram source, or author-supplied diagram labels. Only application-owned controls, generated default labels, and status or error messages follow the interface locale. Finished-document HTML therefore must not derive its language metadata from the shell locale.

## Consequences

- Chinese uses the product name `浮现`; English uses `Fuxian`.
- Main-process dialogs, menus, settings, document controls, export progress, and generated preview controls share one vocabulary.
- New application text must be added to the typed catalog rather than embedded as an untracked renderer string.
- Adding another locale requires a complete catalog and an explicit locale-resolution rule.
