# VoiceOver Core Workflow Review

Review date: 2026-08-28  
Environment: macOS 26.5, VoiceOver, Electron 44  
Document: a local Markdown fixture containing headings, prose, and Mermaid

## Result

Passed the core read-only workflow with VoiceOver enabled and keyboard input only. No unnamed controls, lost focus, or blocked actions were observed.

- Opened a Markdown file from **添加文档** and reached the current document item, which exposed its filename and current-page state.
- Opened and dismissed **内容目录**, navigated headings, and returned focus to the outline trigger.
- Opened **页内查找** with `Command+F`, moved between results, heard the live result count, and returned focus to the finished-document frame on `Escape`.
- Reached the diagram toolbar actions **查看图表源码** and **全屏查看图表**. Both layers exposed a name and description, trapped focus when modal, closed with `Escape`, and returned focus to the originating diagram action.
- Used the full-screen canvas with keyboard zoom, pan, and reset commands.
- Opened **设置**, reached section controls, the optimization help tooltip, switches, sliders, and PlantUML validation controls.
- Started **导出 PDF** from the keyboard and observed the export status complete.

## Automated Checks

`tests/electron/accessibility.spec.ts` repeats this workflow, verifies focus restoration and forced-colors states, and runs axe-core against the reader shell and settings window. There are no known `critical` or `serious` violations. Mermaid-generated SVG internals are not included in the axe shell scan; the finished-document wrapper, diagram toolbar, source, and full-screen actions are checked directly through their exposed roles and names.
