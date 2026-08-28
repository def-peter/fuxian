# Fuxian Interface Prototype

> Status: Pencil review draft. This document defines interaction structure and the first visual review set.

## Product Direction

Fuxian should feel like a focused finished-document reader: quieter than an editor, but more discoverable than a minimal viewer. The document remains the visual center. The application shell supplies only navigation and document-level commands.

Design constraints:

- Run as a single application instance while allowing multiple independent Markdown documents to remain open without creating a project or workspace.
- Show open and recent documents as session navigation, not as a folder tree.
- Restore the previous document session and each document's reading position after restart or an unexpected exit.
- Keep the document iframe visually and technically separate from the application shell.
- Use a compact toolbar and a content outline that is visible by default, collapsible, and remembers the user's preference; omit a file tree and status bar.
- Present diagram and media failures inline at their document position.
- Treat empty, loading, error, and export states as part of the primary workflow.
- Apply one width policy to the entire document instead of allowing diagrams to break out independently.

## Main Window Wireframe

Primary desktop review frame: `1440 x 900`, with an additional approximately `1024 x 768` constrained-width state. Measurements are starting points for Pencil, not implementation constants.

| Region            |   Starting size | Responsibility                                                     |
| ----------------- | --------------: | ------------------------------------------------------------------ |
| Toolbar           |      44 px high | TOC toggle, filename, find, export, overflow menu                  |
| Document session  |     216 px wide | Open documents, recent documents, reading progress, recovery state |
| Document viewport | Remaining space | Scroll container for the isolated document iframe                  |
| Reading column    |      760-900 px | Adaptive, A4, or user-controlled document width                    |
| Content outline   |     216 px wide | Current document headings and active-section indicator             |

The document session occupies the left side, the finished document remains dominant in the center, and the content outline occupies the right side. Both side regions are independently collapsible.

Each region has its own compact header. The document-session header carries the Fuxian identity and open action; the finished-document header carries the filename, external-revision status, and document actions; the content-outline header names and controls the outline.

At wide widths both side regions are visible. At medium widths the content outline collapses behind an always-visible control while the document session remains visible. At narrow widths both side regions become temporary drawers so the finished document retains usable width.

The implemented shell uses three stable viewport bands: wide at `1100 px` and above, medium from `840 px` through `1099 px`, and narrow below `840 px`. Automatic adaptation never overwrites the user's independently persisted document-session and content-outline preferences.

## Primary State Flow

```plantuml
@startuml
!theme mars
skinparam defaultFontName "PingFang SC"
left to right direction

[*] --> Empty
Empty --> Restoring : 恢复上次会话
Empty --> Loading : 打开或拖入 Markdown
Restoring --> Reading : 文档可用并恢复阅读位置
Restoring --> RecoveryWarning : 部分文档不可用
Loading --> Reading : 文件读取并完成首屏渲染
Loading --> BlockingError : 文件读取或解析失败
BlockingError --> Loading : 重试或打开其他文件
BlockingError --> Empty : 取消
Reading --> Loading : 当前文件被外部修改
Reading --> Reading : 切换当前会话中的文档
Reading --> Exporting : 导出 PDF
Exporting --> Reading : 成功、失败或取消
Reading --> Empty : 关闭会话中的最后一份文档

note right of Reading
图片或图表失败时显示正文内错误占位，
不切换到全局错误页面。
end note
@enduml
```

## State Treatments

| State            | Proposed treatment                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------- |
| Empty            | One primary **Open Markdown** action and full-window drag target; no marketing content       |
| Restoring        | Restore available documents and their reading positions without blocking startup             |
| Recovery warning | Keep unavailable documents identifiable and offer locate, retry, or remove actions           |
| Loading          | Preserve the shell and document geometry; show restrained progress in the document area      |
| Reading          | Show the content outline by default, remember its collapsed state, and keep commands compact |
| Inline error     | Replace failed media or diagrams with source-aware error content and a retry action          |
| Blocking error   | Explain the file-level problem and offer retry or open-another-file actions                  |
| Exporting        | Use a focused dialog with render stages, cancellation, and an explicit failure state         |

## Toolbar Contract

Left side:

1. Content outline toggle.
2. Product name when no file is open; filename when reading.

Right side:

1. Find in document.
2. Export PDF.
3. Overflow menu for theme, PlantUML Server settings, and lower-frequency commands.

The operating system owns window controls and the application menu. The content layout should remain consistent across macOS and Windows.

## Confirmed Prototype Decisions

- Reading uses a continuous document surface; paper geometry appears only in print or export preview.
- The content outline is open by default, can be collapsed, and remembers the user's choice.
- The first review demonstrates one distinctive Fuxian document theme rather than a theme gallery.
- Content appears progressively as real render tasks settle; diagrams and formulas must not delay readable text.
- Document width controls the entire white finished-document surface, not an inner prose column. Adaptive mode fills the available reading region with small inner gutters so wide diagrams retain space; A4 and custom modes center a white surface at the selected width. Prose, tables, code, formulas, and diagrams share the resulting inner width without independent breakout. Adaptive width is the initial default; the toolbar switches between adaptive, A4, and custom modes, with a drag control for custom width. The user's later choice is remembered.
- Mermaid and PlantUML diagrams remain selectable content. Hover or keyboard focus exposes source and full-screen controls without replacing the diagram in place.
- Diagram source opens in a side drawer while the rendered diagram remains visible. Full-screen opens a focused layer with zoom, pan, fit-to-window, and return actions.
- Users can select diagram labels, copy diagram source, and copy the rendered SVG.
- Source-authored diagram styling is preserved by default. An optional diagram-optimization setting remains under discussion.
- PlantUML initially uses the public server by default and allows a local or private server to be configured.
- Fuxian runs as one application instance with a restorable multi-document session.
- Open documents and recent documents are session navigation, not a representation of the filesystem hierarchy.
- Restart and crash recovery restore the previously open documents, the active document, and each document's reading position.
- Open and recent documents appear on the left; the active document's content outline appears on the right.
- Document items show identity, active state, external-revision state, and recovery state, but never display reading progress. Recent documents still retain their reading positions after they leave the active session.
- Reading progress is not displayed as a percentage, progress bar, or bottom status bar. The viewport scrollbar communicates spatial progress with low contrast while idle and restrained emphasis during interaction; the content outline communicates semantic position.
- Reading positions use the nearest heading and an offset, with relative document progress as a fallback after content changes.
- Unavailable restored documents remain visible with locate, retry, and remove actions instead of blocking startup or disappearing silently.
- Recent documents contain at most the ten most recently opened documents and expire thirty days after their last open time.
- The current successful document remains visible while a revision renders; replacement is atomic, restores the reading position, and falls back to the previous successful version on failure.
- External-revision status appears temporarily beside the filename as `正在更新...` and `已更新 · time`; failures remain visible with retry and details actions.
- When the reader is already near the end, appended content continues to follow. Otherwise the reading position remains stable and a `有新内容` action appears. Text selection disables automatic following.
- External revisions do not highlight changed paragraphs in the finished document.
- The document-session sidebar places the collapsible `正在打开` section above the collapsible `最近打开` section in one scroll region.
- Closing a document moves it to recent history without clearing its reading position. Reopening it returns it to the open-document set. Quitting Fuxian preserves the open-document set rather than closing it.
- The default document theme uses a sans-serif UI, heading, and 15px body face, plus a monospace code face. Readers may switch the finished document body to the serif preset without changing application-shell typography.
- Document typography settings include a serif or sans-serif body preset, body size, and line height. Application-shell typography remains fixed.
- Document typography and document width are global preferences without per-document overrides in the MVP.
- The separate settings window includes a compact representative document sample. Appearance changes preview immediately and take effect without an Apply step.
- The default light application shell uses the Issue #31 **B: cool neutral** palette: near-black text and primary actions, a pure-white toolbar and framed document surface, `#F2F5F7` side regions, layered neutral hover and selected states, and restrained red only for destructive errors. Focus, success, warning, and external-revision states remain neutral rather than reintroducing a brand accent. The finished-document theme remains independently owned by `document-theme`.
- Every open document is watched for external revisions. The active document renders immediately; inactive open documents render at low priority, cancel obsolete work, and retain only the latest revision task.
- Switching to an inactive document whose latest render is incomplete shows its last successful version immediately with `正在更新...` until the latest version is ready.
- Opening a closed document during external writes shows its cached successful version with `正在同步最新内容...` when available, or a stable loading skeleton otherwise. The first settled revision replaces that state atomically.
- Opening diagram source temporarily replaces the right-side content outline with a wider source drawer. Closing the drawer restores the content outline without changing document position.
- Settings use a separate desktop window with appearance, document, diagram, and PlantUML sections.
- With no open documents, the central start view shows the Fuxian identity, open/drop actions, and recent documents without feature marketing. The document-session sidebar may collapse in this state to avoid duplicating recent documents.
- The start view initially shows five recent documents in a compact list with a `查看全部` action for the remaining history.
- The finished-document header shows filename and external-revision status on the left, with document-width, find, PDF export, and overflow actions on the right.
- The content outline shows headings H1-H3 by default. Deeper headings remain collapsed under their parents, and the active heading is kept visible automatically.
- `Ctrl/Cmd + F` expands an in-header find control with match count, previous, next, and close actions.
- File selection supports multiple Markdown documents. Dropping multiple documents adds all of them to the session, and attempting to open an already-open document activates its existing document item.
- Diagram optimization affects only diagrams without explicit styles: it harmonizes typography, color, background, line treatment, whitespace, and document-width fit without modifying source files.
- The toolbar shows the filename; the complete path is available in a tooltip.
- After the save location is chosen, PDF export uses a non-modal progress panel so reading can continue.
- PDF export progress appears as a stable, collapsible panel at the lower-right of the finished-document region and briefly confirms completion before dismissing.
- Dark mode is designed after the light layout and default document theme are approved.
- The default Fuxian document theme resembles a modern technical publication rather than generic web documentation or an academic-paper template.
- Heading hierarchy relies on type size, weight, spacing, and restrained rules. It does not add automatic numbering, colored title blocks, or decorative pills.
- Code uses a dedicated surface, tables use fine horizontal rules, quotations use a side rule, and diagrams remain unframed unless interaction or failure requires a boundary.
- While Chinese is the only interface language, the document-session header, start view, window title, and system menus use `浮现` without the English name. A future English locale will display `Fuxian`. The finished-document region shows only the active document's identity and actions.
- The application shell uses cool-gray side regions, a cool-white document surface, one-pixel separators, approximately four-pixel control radii, and shadows only for menus, drawers, dialogs, and other overlays.
- Readable text appears immediately. Formulas and diagrams use a restrained approximately 150 ms fade when real rendering completes; ordinary paragraphs do not perform staged entrance animation.
- The identity combines an abstract mark based on content emerging through a boundary with a locale-specific wordmark: `浮现` for Chinese and, once supported, `Fuxian` for English. It avoids generic file, Markdown, and eye symbols.
- The primary Pencil review uses a `1440 x 900` wide state and an approximately `1024 x 768` narrow state.
- The first revised design review covers the start view, main reading state, external revision, diagram source drawer, diagram full-screen view, PDF export, settings window, session recovery failure, and narrow-window behavior. Dark mode follows later.

## Design Tool Decision

The agreed prototype is produced in Pencil (pen.dev). Pencil is the source for visual structure and component relationships; this repository remains authoritative for product behavior and implementation constraints.

## Pencil Handoff Scope

Create these Pencil frames as the first complete review set:

1. Start view with recent documents and open/drop actions.
2. Light main reading window with open/recent documents, a realistic long document, and a content outline.
3. External-revision state while preserving the last successful render.
4. Diagram source drawer and diagram full-screen view.
5. Non-modal PDF export panel.
6. Settings window with a live document sample.
7. Restored-session partial-failure state.
8. Constrained-width window showing responsive panel behavior.

Reusable components should include the toolbar icon button, document row, TOC row, inline status, export stage, and tooltip. Pencil should use semantic layer names, variables for color/type/spacing, and component instances for repeated controls. It may refine spacing, typography, colors, focus states, and platform details without changing the workflow defined here unless the change is recorded in this document.
