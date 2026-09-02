import { indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { Compartment, EditorState, Transaction } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import type { SourceEditorSelection } from '@fuxian/shared-types';

interface SourceEditorProps {
  autoFocus?: boolean;
  onChange(source: string, selection: SourceEditorSelection): void;
  onSave(): void;
  readOnly?: boolean;
  selection: SourceEditorSelection;
  source: string;
}

const sourceEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--card)',
    color: 'var(--foreground)',
    fontSize: '14px',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--accent)' },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--accent)',
    color: 'var(--foreground)',
  },
  '.cm-content': { caretColor: 'var(--primary)', padding: '20px 0 40px' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--primary)' },
  '.cm-foldGutter span': { color: 'var(--muted-foreground)' },
  '.cm-gutters': {
    backgroundColor: 'var(--muted)',
    borderRight: '1px solid var(--border)',
    color: 'var(--muted-foreground)',
  },
  '.cm-line': { padding: '0 20px' },
  '.cm-scroller': {
    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
    lineHeight: '1.7',
    overflow: 'auto',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--selected)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    color: 'var(--popover-foreground)',
  },
});

export function SourceEditor({
  autoFocus = false,
  onChange,
  onSave,
  readOnly = false,
  selection,
  source,
}: SourceEditorProps): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView>(null);
  const editable = useRef(new Compartment());
  const initial = useRef({ autoFocus, readOnly, selection, source });
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSaveRef.current = onSave;
  }, [onChange, onSave]);

  useEffect(() => {
    if (!container.current) return;
    const initialState = initial.current;
    const initialAnchor = Math.min(
      initialState.source.length,
      Math.max(0, initialState.selection.anchor),
    );
    const initialHead = Math.min(
      initialState.source.length,
      Math.max(0, initialState.selection.head),
    );
    const view = new EditorView({
      parent: container.current,
      state: EditorState.create({
        doc: initialState.source,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          sourceEditorTheme,
          EditorView.contentAttributes.of({ 'aria-label': 'Markdown 源码编辑器' }),
          editable.current.of(EditorState.readOnly.of(initialState.readOnly)),
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                onSaveRef.current();
                return true;
              },
            },
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged && !update.selectionSet) return;
            const nextSelection = update.state.selection.main;
            onChangeRef.current(update.state.doc.toString(), {
              anchor: nextSelection.anchor,
              head: nextSelection.head,
            });
          }),
        ],
        selection: { anchor: initialAnchor, head: initialHead },
      }),
    });
    editor.current = view;
    if (initialState.autoFocus) window.requestAnimationFrame(() => view.focus());
    return () => {
      editor.current = null;
      view.destroy();
    };
  }, []);

  useEffect(() => {
    editor.current?.dispatch({
      effects: editable.current.reconfigure(EditorState.readOnly.of(readOnly)),
    });
  }, [readOnly]);

  useEffect(() => {
    const view = editor.current;
    if (!view || view.state.doc.toString() === source) return;
    const anchor = Math.min(source.length, Math.max(0, selection.anchor));
    const head = Math.min(source.length, Math.max(0, selection.head));
    view.dispatch({
      annotations: Transaction.addToHistory.of(false),
      changes: { from: 0, insert: source, to: view.state.doc.length },
      selection: { anchor, head },
    });
  }, [selection.anchor, selection.head, source]);

  return <div className="h-full min-h-0 overflow-hidden" ref={container} />;
}

export default SourceEditor;
