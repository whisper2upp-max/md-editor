import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
export { undo as cmUndo, redo as cmRedo } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export interface CodeMirrorHandle {
  view: EditorView
  getValue: () => string
  setValue: (v: string) => void
  scrollToLine: (line1: number) => void
  scrollToRange: (from: number, to: number) => void
  getSelectedText: () => string
  wrapSelection: (before: string, after: string) => void
  insertText: (text: string) => void
  setHeadingLevel: (level: number) => void
  caretAtCoords: (x: number, y: number) => void
  focus: () => void
  destroy: () => void
}

export interface CreateCodeModeOptions {
  parent: HTMLElement
  doc?: string
  onChange?: (value: string) => void
}

export function createCodeMode(opts: CreateCodeModeOptions): CodeMirrorHandle {
  const changeListener = EditorView.updateListener.of((u) => {
    if (u.docChanged) opts.onChange?.(u.state.doc.toString())
  })
  const themeCompartment = new Compartment()

  const view = new EditorView({
    parent: opts.parent,
    state: EditorState.create({
      doc: opts.doc ?? '',
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        themeCompartment.of([]),
        changeListener,
        EditorView.theme({
          '&': { height: '100%', fontSize: '14px' },
          '.cm-scroller': {
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            lineHeight: '1.7',
          },
          '.cm-content': { padding: '16px 0' },
        }),
      ],
    }),
  })

  const setValue = (v: string) => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } })
  }

  const scrollToRange = (from: number, to: number) => {
    const max = view.state.doc.length
    const a = Math.max(0, Math.min(from, max))
    const b = Math.max(0, Math.min(to, max))
    view.dispatch({
      selection: { anchor: a, head: b },
      effects: EditorView.scrollIntoView(a, { y: 'center' }),
    })
    view.focus()
  }

  const scrollToLine = (line1: number) => {
    const total = view.state.doc.lines
    const ln = Math.max(1, Math.min(line1, total))
    const line = view.state.doc.line(ln)
    scrollToRange(line.from, line.to)
  }

  const getSelectedText = () => {
    const { from, to } = view.state.selection.main
    return view.state.sliceDoc(from, to)
  }

  const wrapSelection = (before: string, after: string) => {
    const { from, to } = view.state.selection.main
    const selected = view.state.sliceDoc(from, to)
    const insert = `${before}${selected}${after}`
    view.dispatch({
      changes: { from, to, insert },
      selection: { anchor: from + before.length, head: from + before.length + selected.length },
    })
    view.focus()
  }

  const insertText = (text: string) => {
    const { from, to } = view.state.selection.main
    view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } })
    view.focus()
  }

  const setHeadingLevel = (level: number) => {
    const line = view.state.doc.lineAt(view.state.selection.main.head)
    const stripped = line.text.replace(/^\s*#{1,6}\s+/, '')
    const prefix = level > 0 ? `${'#'.repeat(level)} ` : ''
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${prefix}${stripped}` },
    })
    view.focus()
  }

  const caretAtCoords = (x: number, y: number) => {
    const pos = view.posAtCoords({ x, y })
    if (pos == null) return
    const sel = view.state.selection.main
    if (!sel.empty && pos >= sel.from && pos <= sel.to) return
    view.dispatch({ selection: { anchor: pos } })
    view.focus()
  }

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue,
    scrollToLine,
    scrollToRange,
    getSelectedText,
    wrapSelection,
    insertText,
    setHeadingLevel,
    caretAtCoords,
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  }
}
