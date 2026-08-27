# Use shadcn/ui for the application shell

Fuxian uses shadcn/ui as its unified application-shell component system, with Tailwind CSS, the default Radix base, CSS variables, and Lucide icons. This choice prioritizes implementation speed, a broad set of composable components, and source code that remains transparent to both maintainers and coding agents.

Generated shadcn components become Fuxian-owned source code. They must follow Fuxian's restrained technical-publication visual language instead of preserving shadcn's default appearance. Product-specific controls should be composed from this foundation rather than introducing a second general-purpose headless UI system.

This decision applies only to the Electron renderer's application shell. The Markdown AST pipeline remains independent of React and Electron, while finished-document styling stays isolated in `document-theme` and the preview iframe. Reconsider this decision if maintaining generated components becomes materially more expensive than adopting a versioned component package, or if the chosen primitives cannot meet required desktop interaction and accessibility behavior.
