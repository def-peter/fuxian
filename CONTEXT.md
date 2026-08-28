# Fuxian

Fuxian turns Markdown source documents into polished, trustworthy documents for reading and PDF delivery. It serves people who want the finished result without working directly with Markdown syntax.

## Language

**Source document**:
One `.md` or `.markdown` file opened by the user, including references to local resources and renderable content. A source document remains independent of folders, projects, and other open documents.
_Avoid_: Project, workspace, vault

**Document session**:
The ordered set of open source documents, the active document, and their restorable reading state in the single running application instance.
_Avoid_: Workspace, project, window

**Open document**:
A source document currently retained in the document session and available for immediate switching.
_Avoid_: Tab, open file

**Active document**:
The one open document currently displayed in the finished-document region.
_Avoid_: Current file, foreground document

**Inactive open document**:
An open document retained in the document session but not currently displayed. It remains distinct from a recent document.
_Avoid_: Background document, recent document

**Document item**:
One open or recent document represented in the document-session list. It identifies the document and may communicate active, update, or recovery state, but does not display reading progress.
_Avoid_: File row, file node

**Recent document**:
A previously opened source document retained as history but not currently part of the document session. Fuxian retains at most the ten most recently opened documents for thirty days, including their reading positions.
_Avoid_: Open document, file directory

**Reading position**:
The restorable location reached by the user within a document. It is anchored to the nearest heading with an offset and falls back to relative document progress when that heading no longer exists.
_Avoid_: Scroll position, progress percentage

**External revision**:
A stable change written to an open source document by another process while Fuxian is running. A burst of writes settles into one external revision rather than many user-visible updates.
_Avoid_: Reload, edit conflict

**Finished document**:
The reading and print representation produced from a source document, including typography, diagrams, formulas, code, tables, and images.
_Avoid_: Preview, rendered page

**Document width**:
The global width preference applied consistently to every finished document. It may be adaptive, constrained to A4 proportions, or set by the user, but individual documents and content blocks do not choose independent widths.
_Avoid_: Diagram width, content card width

**Document typography**:
The global configurable typography of finished documents: serif or sans-serif body preset, body size, and line height. Application-shell typography remains fixed and separate.
_Avoid_: UI font, custom CSS

**Content outline**:
Navigation generated from headings in the current source document. It navigates document structure and is not a browser for files or folders.
_Avoid_: Directory, file directory, file tree

**Start view**:
The functional surface shown when no documents are open. It provides open and drop actions plus access to recent documents, without product-feature marketing.
_Avoid_: Welcome page, landing page

**Rendered visual block**:
A source block that becomes selectable SVG content within the finished document. Diagram blocks and visualization blocks share source inspection, focused viewing, copying, readiness, and explicit inline failure behavior.
_Avoid_: Image, attachment

**Diagram block**:
A Mermaid or PlantUML rendered visual block that expresses processes, structures, sequences, or relationships.
_Avoid_: Visualization block, chart

**Visualization block**:
A Vega-Lite rendered visual block that expresses quantitative data as a chart from an author-provided specification.
_Avoid_: Diagram block, dashboard
